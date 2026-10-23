#!/usr/bin/env bash

# Dev-OS Environment & Config Parity Scanner (Layer 2 Gate)
# Audits codebase to ensure all environment variables used in code are documented in .env.example
# and ensures no live secrets are accidentally committed to .env.example.
# Enforces Hard Rule #20.

TARGET_DIR="$1"
if [ -z "$TARGET_DIR" ]; then
    TARGET_DIR="."
fi

LIVE_SECRET_RE='(sk_live_[0-9a-zA-Z]{20,}|ghp_[0-9a-zA-Z]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA|OPENSSH|EC|DSA)? ?PRIVATE KEY-----|eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,})'

# File mode (used by the PostToolUse hook): check one .env* file only.
#   .env.example / .env.sample / .env.template / .env.dist: must not contain live credentials.
#   any other .env* file: must not be tracked by git (it is expected to hold real secrets).
if [ -f "$TARGET_DIR" ]; then
    FILE="$TARGET_DIR"
    echo "Dev-OS Environment Audit (file): '$FILE'..."
    case "$(basename "$FILE")" in
        *.example|*.sample|*.template|*.dist)
            HITS=$(grep -Ein "$LIVE_SECRET_RE" "$FILE" 2>/dev/null | cut -d: -f1)
            if [ -n "$HITS" ]; then
                echo "  [ FAIL ] [ENV §1] Probable LIVE credential or private key in '$FILE' (values not shown):"
                echo "$HITS" | sed 's/^/      line /'
                echo "      Replace it with a placeholder (e.g. API_KEY=your_key_here) and rotate the credential."
                exit 1
            fi
            ;;
        *)
            DIR=$(dirname "$FILE")
            if git -C "$DIR" ls-files --error-unmatch -- "$(basename "$FILE")" >/dev/null 2>&1; then
                echo "  [ FAIL ] [ENV §3] '$FILE' is tracked by git but holds environment secrets (Hard Rule 2)."
                echo "      Add it to .gitignore, untrack it (the human runs: git rm --cached), and document keys in .env.example."
                exit 1
            fi
            ;;
    esac
    echo "[ OK ] Environment Audit Passed: '$FILE'."
    exit 0
fi

ENV_EXAMPLE="$TARGET_DIR/.env.example"
FAILURES=0

echo "Dev-OS Environment & Config Parity Audit: Scanning '$TARGET_DIR'..."

# If there are no source files or this is an empty directory, skip cleanly
SOURCE_FILES=$(find "$TARGET_DIR" -type f \( \
    -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o \
    -name "*.py" -o -name "*.php" -o -name "*.go" -o -name "*.rs" \
\) \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/.venv/*" \
    -not -path "*/venv/*" \
    -not -path "*/env/*" \
    -not -path "*/site-packages/*" \
    -not -path "*/vendor/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "*/.next/*" \
    -not -path "*/_backup/*" \
    -not -path "*/.agents/*" \
    -not -path "*/scripts/smoke-test.js" \
    -not -path "*/scripts/eval-runner.js" \
    -not -path "*/bin/devos.js" \
2>/dev/null)

if [ -z "$SOURCE_FILES" ]; then
    echo "[ INFO ] No application source files found to audit."
    echo "[ OK ] Environment Parity Audit: Clean."
    exit 0
fi

# 1. Check for committed secrets in .env.example if it exists
if [ -f "$ENV_EXAMPLE" ]; then
    # Look for likely live credentials in .env.example (sk_live_, ghp_, eyJ, private keys, AWS keys)
    SUSPICIOUS_SECRETS=$(grep -Ein "$LIVE_SECRET_RE" "$ENV_EXAMPLE" 2>/dev/null)
    if [ -n "$SUSPICIOUS_SECRETS" ]; then
        echo "  [ FAIL ] [ENV §1] Probable LIVE credential or private key committed in '$ENV_EXAMPLE':"
        # Report line numbers only: echoing the matched value would leak the secret into logs (Hard Rule 2).
        echo "$SUSPICIOUS_SECRETS" | cut -d: -f1 | sed 's/^/      line /'
        FAILURES=$((FAILURES + 1))
    fi
fi

# 2. Extract referenced environment variables from source files
# Node/JS: process.env.VAR_NAME or process.env['VAR_NAME']
# Python: os.environ.get('VAR_NAME') or os.environ['VAR_NAME'] or os.getenv('VAR_NAME')
# PHP: env('VAR_NAME')
RAW_VARS=$(printf '%s\n' "$SOURCE_FILES" | tr '\n' '\0' | xargs -0 grep -Eho "(process\.env\.[A-Z0-9_]+|process\.env\['[A-Z0-9_]+'\]|process\.env\[\"[A-Z0-9_]+\"\]|os\.(environ|getenv)[(\[]['\"][A-Z0-9_]+['\"][)\]]|env\(['\"][A-Z0-9_]+['\"]\))" 2>/dev/null)

if [ -z "$RAW_VARS" ]; then
    echo "[ INFO ] No environment variable references found in source code."
    echo "[ OK ] Environment Parity Audit: Clean."
    exit 0
fi

# Clean up variables to pure names
CLEAN_VARS=$(echo "$RAW_VARS" | sed -E \
    -e "s/process\.env\.([A-Z0-9_]+)/\1/g" \
    -e "s/process\.env\['([A-Z0-9_]+)'\]/\1/g" \
    -e "s/process\.env\[\"([A-Z0-9_]+)\"\]/\1/g" \
    -e "s/os\.(environ|getenv)[(\[]['\"]([A-Z0-9_]+)['\"][)\]]/\2/g" \
    -e "s/env\(['\"]([A-Z0-9_]+)['\"]\)/\1/g" \
    | sort -u)

# System/Standard variables to ignore
IGNORED_VARS="NODE_ENV|PORT|CI|HOSTNAME|TZ|PWD|SHELL|USER|PATH|HOME|TERM|COLORTERM|NO_COLOR|FORCE_COLOR|DEBUG|LANG|LC_ALL|EDITOR"

MISSING_VARS=()

for var in $CLEAN_VARS; do
    # Skip standard system vars
    if echo "$var" | grep -Eq "^($IGNORED_VARS)$"; then
        continue
    fi

    # If .env.example does not exist, any non-standard env var is missing documentation
    if [ ! -f "$ENV_EXAMPLE" ]; then
        MISSING_VARS+=("$var")
    else
        # Check if variable name is defined in .env.example
        if ! grep -Eq "^[[:space:]]*#?[[:space:]]*${var}=" "$ENV_EXAMPLE"; then
            MISSING_VARS+=("$var")
        fi
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo ""
    echo "  [ FAIL ] [ENV §2] Environment variables referenced in code but MISSING from '$ENV_EXAMPLE':"
    for m in "${MISSING_VARS[@]}"; do
        # Find which file references it
        REF_FILE=$(printf '%s\n' "$SOURCE_FILES" | tr '\n' '\0' | xargs -0 grep -lw "$m" 2>/dev/null | head -n 1)
        echo "      - $m (referenced in: $REF_FILE)"
    done
    FAILURES=$((FAILURES + ${#MISSING_VARS[@]}))
fi

if [ "$FAILURES" -gt 0 ]; then
    echo ""
    echo "[ FAIL ] Environment & Config Parity Audit Failed: $FAILURES issue(s) detected."
    echo "   Remediation:"
    echo "     1. Ensure '$ENV_EXAMPLE' exists at the project root."
    echo "     2. Add missing variables with placeholder values (e.g., API_KEY=your_key_here)."
    echo "     3. Never commit live production secrets to version control."
    exit 1
else
    TOTAL_CHECKED=$(echo "$CLEAN_VARS" | wc -w | tr -d ' ')
    echo "[ OK ] Environment Parity Audit Passed: All $TOTAL_CHECKED referenced environment variables documented in '$ENV_EXAMPLE'!"
    exit 0
fi
