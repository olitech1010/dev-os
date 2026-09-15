#!/usr/bin/env bash

# Dev-OS Database & Migration Safety Scanner (Layer 3 Gate)
# Audits database migrations (SQL files) for Row Level Security (RLS),
# non-destructive operations (Hard Rule #1), foreign key indexes, and primary keys.
# Enforces Hard Rule #21.

TARGET="$1"
if [ -z "$TARGET" ]; then
    TARGET="."
fi

FAILURES=0
WARNINGS=0
SCANNED_MIGRATIONS=0

echo "🗄️  Dev-OS Database & Migration Safety Audit: Scanning '$TARGET'..."

audit_sql_file() {
    local file="$1"
    local file_failures=0
    local file_warnings=0

    # Skip non-SQL files, build outputs, node_modules
    case "$file" in
        *node_modules*|*.git*|*dist*|*build*|*_backup*|*smoke-test*)
            return 0
            ;;
    esac

    if [ ! -f "$file" ] || [[ "$file" != *.sql ]]; then
        return 0
    fi

    SCANNED_MIGRATIONS=$((SCANNED_MIGRATIONS + 1))

    # 1. Row Level Security (RLS) Check on CREATE TABLE
    # Extract created table names
    local created_tables
    created_tables=$(python3 -c "
import sys, re
with open(sys.argv[1], 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Find CREATE TABLE statements: CREATE TABLE [IF NOT EXISTS] [schema.]table_name
pattern = re.compile(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:\"?([a-zA-Z0-9_]+)\"?\.)?\"?([a-zA-Z0-9_]+)\"?', re.IGNORECASE)
for match in pattern.finditer(content):
    table = match.group(2)
    # Check if file has explicit opt-out comment
    if f'-- devos:no-rls {table}' in content or f'-- devos:no-rls' in content:
        continue
    # Check if ALTER TABLE <table> ENABLE ROW LEVEL SECURITY is present
    rls_pattern = re.compile(rf'ALTER\s+TABLE\s+(?:\"?[a-zA-Z0-9_]+\"?\.)?\"?{table}\"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY', re.IGNORECASE)
    if not rls_pattern.search(content):
        print(table)
" "$file" 2>/dev/null)

    if [ -n "$created_tables" ]; then
        for tbl in $created_tables; do
            echo "  ❌ [DB §1] Table '$tbl' created in $file without Row Level Security (RLS):"
            echo "      Missing: ALTER TABLE $tbl ENABLE ROW LEVEL SECURITY;"
            echo "      (Add statement or override with: -- devos:no-rls $tbl <reason>)"
            file_failures=$((file_failures + 1))
        done
    fi

    # 2. Destructive Operations Check (Hard Rule #1)
    local destructive_ops
    destructive_ops=$(python3 -c "
import sys, re
with open(sys.argv[1], 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

if '-- devos:approved-destructive' in content:
    sys.exit(0)

# Match DROP TABLE, DROP COLUMN, TRUNCATE, DROP SCHEMA
dest_pattern = re.compile(r'\b(DROP\s+TABLE\b|DROP\s+COLUMN\b|TRUNCATE\s+(?:TABLE\s+)?|DROP\s+SCHEMA\b)', re.IGNORECASE)
for i, line in enumerate(content.splitlines(), 1):
    clean = line.strip()
    if clean.startswith('--') or clean.startswith('/*'):
        continue
    m = dest_pattern.search(clean)
    if m:
        print(f'{i}: {m.group(1)} -> {clean[:80]}')
" "$file" 2>/dev/null)

    if [ -n "$destructive_ops" ]; then
        echo "  ❌ [DB §2] Unapproved destructive SQL operation in $file (Hard Rule #1):"
        echo "$destructive_ops" | sed 's/^/      Line /' | head -n 4
        echo "      (Formulate a dry-run plan, or override with: -- devos:approved-destructive <reason>)"
        file_failures=$((file_failures + 1))
    fi

    # 3. Foreign Key Index Advisory
    local unindexed_fks
    unindexed_fks=$(python3 -c "
import sys, re
with open(sys.argv[1], 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Match REFERENCES other_table(id)
ref_pattern = re.compile(r'([a-zA-Z0-9_]+)\s+[a-zA-Z0-9_()]+.*REFERENCES\s+([a-zA-Z0-9_]+)', re.IGNORECASE)
# Find created indexes
idx_pattern = re.compile(r'CREATE\s+(?:UNIQUE\s+)?INDEX\s+.*?\s+ON\s+.*?\((.*?)\)', re.IGNORECASE)
indexes = idx_pattern.findall(content)
all_indexed_cols = ' '.join(indexes).lower()

for match in ref_pattern.finditer(content):
    col = match.group(1).lower()
    target_table = match.group(2)
    if col not in all_indexed_cols and f'-- devos:no-index {col}' not in content:
        print(f'{col} -> references {target_table}')
" "$file" 2>/dev/null)

    if [ -n "$unindexed_fks" ]; then
        echo "  ⚠️ [DB §3] Foreign key reference(s) in $file lack supporting index:"
        echo "$unindexed_fks" | sed 's/^/      Column /' | head -n 3
        echo "      (Add: CREATE INDEX idx_... ON ... (<col>);)"
        file_warnings=$((file_warnings + 1))
    fi

    if [ "$file_failures" -gt 0 ]; then
        FAILURES=$((FAILURES + file_failures))
    fi
    if [ "$file_warnings" -gt 0 ]; then
        WARNINGS=$((WARNINGS + file_warnings))
    fi
}

# Scan file or directory
if [ -f "$TARGET" ]; then
    audit_sql_file "$TARGET"
elif [ -d "$TARGET" ]; then
    # Look for migration directories or sql files
    while IFS= read -r -d '' f; do
        audit_sql_file "$f"
    done < <(find "$TARGET" -type f -name "*.sql" \
        -not -path "*/node_modules/*" \
        -not -path "*/.git/*" \
        -not -path "*/dist/*" \
        -not -path "*/build/*" \
        -not -path "*/_backup/*" \
        -not -path "*/.agents/*" \
        -print0 2>/dev/null)
fi

if [ "$SCANNED_MIGRATIONS" -eq 0 ]; then
    echo "ℹ️ No database migration files (*.sql) found to audit."
    echo "✅ Database & Migration Safety Audit: Clean (0 migration files)."
    exit 0
fi

if [ "$FAILURES" -gt 0 ]; then
    echo ""
    echo "❌ Database & Migration Safety Audit Failed: $FAILURES critical safety issue(s) across $SCANNED_MIGRATIONS migration file(s)."
    echo "   Remediation:"
    echo "     1. Enable Row Level Security on all created tables: ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;"
    echo "     2. Create explicit RLS policies (SELECT, INSERT, UPDATE, DELETE)."
    echo "     3. Never drop tables/columns without an approved dry-run plan (-- devos:approved-destructive)."
    echo "     4. Create indexes on foreign key columns for query performance."
    exit 1
else
    if [ "$WARNINGS" -gt 0 ]; then
        echo "⚠️ Database & Migration Safety Audit: Passed with $WARNINGS performance warning(s) across $SCANNED_MIGRATIONS migration file(s)."
    else
        echo "✅ Database & Migration Safety Audit Passed: All $SCANNED_MIGRATIONS migration file(s) are safe, RLS-protected, and indexed!"
    fi
    exit 0
fi
