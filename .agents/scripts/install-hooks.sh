#!/bin/bash

# Dev-OS Git Hooks Installer
# Installs mechanical pre-commit hooks to enforce gitleaks secret scanning and the Dev-OS commit gate.

set -e

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

if [ -z "$REPO_ROOT" ]; then
    echo "[ FAIL ] Error: Current directory is not inside a git repository."
    exit 1
fi

HOOKS_DIR="$REPO_ROOT/.git/hooks"
PRE_COMMIT_HOOK="$HOOKS_DIR/pre-commit"

echo "======================================"
echo "   Dev-OS Git Hooks Installation"
echo "======================================"
echo "Target repo: $REPO_ROOT"
echo ""

mkdir -p "$HOOKS_DIR"

# Back up any existing pre-commit hook that is not a Dev-OS hook before overwriting it.
if [ -f "$PRE_COMMIT_HOOK" ] && ! grep -q "DEVOS_COMMIT_APPROVED" "$PRE_COMMIT_HOOK"; then
    BACKUP_PATH="$PRE_COMMIT_HOOK.backup.$(date +%Y%m%d%H%M%S)"
    cp "$PRE_COMMIT_HOOK" "$BACKUP_PATH"
    echo "[ WARN ] Existing non-Dev-OS pre-commit hook detected. Backed it up to: $BACKUP_PATH"
fi

cat << 'EOF' > "$PRE_COMMIT_HOOK"
#!/bin/bash

# Dev-OS Pre-Commit Gate & Secret Scanner

echo "[ INFO ] Running Dev-OS Pre-Commit Checks..."

# 1. Enforce Dev-OS Commit Gate (Must run via commit.sh or have approval token)
if [ "$DEVOS_COMMIT_APPROVED" != "true" ]; then
    echo ""
    echo "[ FAIL ] DEV-OS GATE ERROR: Direct 'git commit' is disabled by policy."
    echo "-> You must run '.agents/scripts/commit.sh' to commit changes after QA approval."
    echo "   (Or export DEVOS_COMMIT_APPROVED=true if executing authorized automated pipeline)"
    echo ""
    exit 1
fi

# 2. Secret Scanning via Gitleaks
if command -v gitleaks >/dev/null 2>&1; then
    echo "[ INFO ] Scanning staged diff for hardcoded secrets with Gitleaks..."
    if ! gitleaks git --staged --verbose; then
        echo ""
        echo "[ FAIL ] GITLEAKS ERROR: Hardcoded secret or API key detected in staged files."
        echo "[ WARN ] Commit aborted to prevent secret leak."
        echo ""
        exit 1
    fi
    echo "[ OK ] Secret scan clean."
else
    echo "[ WARN ] 'gitleaks' is not installed on your system."
    echo "   Install gitleaks to enable automated mechanical secret scanning: 'brew install gitleaks'"
fi

echo "[ OK ] Dev-OS pre-commit checks passed."
exit 0
EOF

chmod +x "$PRE_COMMIT_HOOK"

echo "[ OK ] Pre-commit hook successfully installed at: $PRE_COMMIT_HOOK"
