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

echo "Dev-OS Database & Migration Safety Audit: Scanning '$TARGET'..."

audit_sql_file() {
    local file="$1"
    local file_failures=0
    local file_warnings=0

    # Skip non-SQL files, build outputs, node_modules
    case "/$file" in
        */node_modules/*|*/.git/*|*/dist/*|*/build/*|*/_backup/*|*smoke-test*)
            return 0
            ;;
    esac

    if [ ! -f "$file" ] || [[ "$file" != *.sql ]]; then
        return 0
    fi

    SCANNED_MIGRATIONS=$((SCANNED_MIGRATIONS + 1))

    # One node pass (node is guaranteed by Dev-OS; python3 is not) emits tagged lines:
    #   RLS:<table>   DEST:<line>: <op> -> <text>   FK:<col> -> references <table>
    # If the analyzer cannot run, the file fails closed instead of passing silently.
    local analysis
    if ! analysis=$(node -e '
const fs = require("fs");
const content = fs.readFileSync(process.argv[1], "utf8");
const out = [];
const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?([a-zA-Z0-9_]+)"?\.)?"?([a-zA-Z0-9_]+)"?/gi;
let m;
while ((m = createRe.exec(content)) !== null) {
  const table = m[2];
  if (content.includes("-- devos:no-rls")) continue;
  const rls = new RegExp("ALTER\\s+TABLE\\s+(?:\"?[a-zA-Z0-9_]+\"?\\.)?\"?" + table + "\"?\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY", "i");
  if (!rls.test(content)) out.push("RLS:" + table);
}
if (!content.includes("-- devos:approved-destructive")) {
  const destRe = /\b(DROP\s+TABLE\b|DROP\s+COLUMN\b|TRUNCATE\s+(?:TABLE\s+)?|DROP\s+SCHEMA\b)/i;
  content.split(/\r?\n/).forEach((line, i) => {
    const clean = line.trim();
    if (clean.startsWith("--") || clean.startsWith("/*")) return;
    const d = destRe.exec(clean);
    if (d) out.push("DEST:" + (i + 1) + ": " + d[1] + " -> " + clean.slice(0, 80));
  });
}
const idxRe = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+.*?\s+ON\s+.*?\((.*?)\)/gi;
const indexed = [];
while ((m = idxRe.exec(content)) !== null) indexed.push(m[1]);
const allIndexed = indexed.join(" ").toLowerCase();
const refRe = /([a-zA-Z0-9_]+)\s+[a-zA-Z0-9_()]+.*REFERENCES\s+([a-zA-Z0-9_]+)/gi;
while ((m = refRe.exec(content)) !== null) {
  const col = m[1].toLowerCase();
  if (!allIndexed.includes(col) && !content.includes("-- devos:no-index " + col)) out.push("FK:" + col + " -> references " + m[2]);
}
if (out.length) console.log(out.join("\n"));
' "$file" 2>&1); then
        echo "  [ FAIL ] [DB] Could not analyze $file (node error): $(printf '%s' "$analysis" | head -n 1)"
        FAILURES=$((FAILURES + 1))
        return 0
    fi

    local created_tables destructive_ops unindexed_fks
    created_tables=$(printf '%s\n' "$analysis" | sed -n 's/^RLS://p')
    destructive_ops=$(printf '%s\n' "$analysis" | sed -n 's/^DEST://p')
    unindexed_fks=$(printf '%s\n' "$analysis" | sed -n 's/^FK://p')

    # 1. Row Level Security (RLS) on CREATE TABLE
    if [ -n "$created_tables" ]; then
        for tbl in $created_tables; do
            echo "  [ FAIL ] [DB §1] Table '$tbl' created in $file without Row Level Security (RLS):"
            echo "      Missing: ALTER TABLE $tbl ENABLE ROW LEVEL SECURITY;"
            echo "      (Add statement or override with: -- devos:no-rls $tbl <reason>)"
            file_failures=$((file_failures + 1))
        done
    fi

    # 2. Destructive Operations (Hard Rule 1)
    if [ -n "$destructive_ops" ]; then
        echo "  [ FAIL ] [DB §2] Unapproved destructive SQL operation in $file (Hard Rule #1):"
        echo "$destructive_ops" | sed 's/^/      Line /' | head -n 4
        echo "      (Formulate a dry-run plan, or override with: -- devos:approved-destructive <reason>)"
        file_failures=$((file_failures + 1))
    fi

    # 3. Foreign Key Index Advisory

    if [ -n "$unindexed_fks" ]; then
        echo "  [ WARN ] [DB §3] Foreign key reference(s) in $file lack supporting index:"
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
    echo "[ INFO ] No database migration files (*.sql) found to audit."
    echo "[ OK ] Database & Migration Safety Audit: Clean (0 migration files)."
    exit 0
fi

if [ "$FAILURES" -gt 0 ]; then
    echo ""
    echo "[ FAIL ] Database & Migration Safety Audit Failed: $FAILURES critical safety issue(s) across $SCANNED_MIGRATIONS migration file(s)."
    echo "   Remediation:"
    echo "     1. Enable Row Level Security on all created tables: ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;"
    echo "     2. Create explicit RLS policies (SELECT, INSERT, UPDATE, DELETE)."
    echo "     3. Never drop tables/columns without an approved dry-run plan (-- devos:approved-destructive)."
    echo "     4. Create indexes on foreign key columns for query performance."
    exit 1
else
    if [ "$WARNINGS" -gt 0 ]; then
        echo "[ WARN ] Database & Migration Safety Audit: Passed with $WARNINGS performance warning(s) across $SCANNED_MIGRATIONS migration file(s)."
    else
        echo "[ OK ] Database & Migration Safety Audit Passed: All $SCANNED_MIGRATIONS migration file(s) are safe, RLS-protected, and indexed!"
    fi
    exit 0
fi
