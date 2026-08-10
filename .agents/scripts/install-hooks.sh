#!/bin/bash

# Dev-OS Git Hooks Installer
# Installs mechanical pre-commit hooks to enforce gitleaks secret scanning and the Dev-OS commit gate.

set -e

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

if [ -z "$REPO_ROOT" ]; then
    echo "❌ Error: Current directory is not inside a git repository."
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

cat << 'EOF' > "$PRE_COMMIT_HOOK"
#!/bin/bash

# Dev-OS Pre-Commit Gate & Secret Scanner

echo "🔍 Running Dev-OS Pre-Commit Checks..."

# 1. Enforce Dev-OS Commit Gate (Must run via commit.sh or have approval token)
if [ "$DEVOS_COMMIT_APPROVED" != "true" ]; then
    echo ""
    echo "❌ DEV-OS GATE ERROR: Direct 'git commit' is disabled by policy."
    echo "👉 You must run '.agents/scripts/commit.sh' to commit changes after QA approval."
    echo "   (Or export DEVOS_COMMIT_APPROVED=true if executing authorized automated pipeline)"
    echo ""
    exit 1
fi

# 2. Secret Scanning via Gitleaks
if command -v gitleaks >/dev/null 2>&1; then
    echo "🔒 Scanning staged diff for hardcoded secrets with Gitleaks..."
    gitleaks protect --staged --verbose
    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ GITLEAKS ERROR: Hardcoded secret or API key detected in staged files."
        echo "⚠️ Commit aborted to prevent secret leak."
        echo ""
        exit 1
    fi
    echo "✅ Secret scan clean."
else
    echo "⚠️ WARNING: 'gitleaks' is not installed on your system."
    echo "   Install gitleaks to enable automated mechanical secret scanning: 'brew install gitleaks'"
fi

echo "✅ Dev-OS pre-commit checks passed."
exit 0
EOF

chmod +x "$PRE_COMMIT_HOOK"

echo "✅ Pre-commit hook successfully installed at: $PRE_COMMIT_HOOK"
