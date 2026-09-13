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

# Check and attempt automated gitleaks installation or update
GITLEAKS_FOUND=""
if command -v gitleaks >/dev/null 2>&1; then
    GITLEAKS_FOUND="$(command -v gitleaks)"
elif [ -x "$REPO_ROOT/.agents/bin/gitleaks" ]; then
    GITLEAKS_FOUND="$REPO_ROOT/.agents/bin/gitleaks"
fi

if [ -n "$GITLEAKS_FOUND" ]; then
    GL_VER=$("$GITLEAKS_FOUND" version 2>/dev/null | head -n 1 || echo "active")
    echo "[ OK ] Gitleaks detected: $GITLEAKS_FOUND (v$GL_VER)"
    if command -v brew >/dev/null 2>&1; then
        if HOMEBREW_NO_AUTO_UPDATE=1 brew outdated gitleaks 2>/dev/null | grep -q "gitleaks"; then
            echo "[ INFO ] Updating Gitleaks via Homebrew..."
            HOMEBREW_NO_AUTO_UPDATE=1 brew upgrade gitleaks 2>/dev/null || true
        fi
    fi
else
    echo "[ INFO ] Gitleaks not found. Attempting automated installation..."
    INSTALLED=0
    if command -v brew >/dev/null 2>&1; then
        echo "[ INFO ] Installing Gitleaks via Homebrew..."
        if HOMEBREW_NO_AUTO_UPDATE=1 brew install gitleaks 2>/dev/null; then
            INSTALLED=1
            echo "[ OK ] Gitleaks installed successfully via Homebrew."
        fi
    fi
    if [ "$INSTALLED" -eq 0 ] && command -v snap >/dev/null 2>&1; then
        echo "[ INFO ] Installing Gitleaks via snap..."
        if snap install gitleaks 2>/dev/null || sudo snap install gitleaks 2>/dev/null; then
            INSTALLED=1
            echo "[ OK ] Gitleaks installed successfully via snap."
        fi
    fi
    if [ "$INSTALLED" -eq 0 ] && command -v curl >/dev/null 2>&1 && command -v tar >/dev/null 2>&1; then
        OS=$(uname -s | tr '[:upper:]' '[:lower:]')
        ARCH=$(uname -m)
        case "$ARCH" in
            x86_64) ARCH="x64" ;;
            arm64|aarch64) ARCH="arm64" ;;
            *) ARCH="" ;;
        esac
        if [ "$OS" = "darwin" ] || [ "$OS" = "linux" ]; then
            if [ -n "$ARCH" ]; then
                echo "[ INFO ] Downloading standalone Gitleaks binary from GitHub..."
                mkdir -p "$REPO_ROOT/.agents/bin"
                DL_VER="8.30.1"
                TAR_URL="https://github.com/gitleaks/gitleaks/releases/download/v${DL_VER}/gitleaks_${DL_VER}_${OS}_${ARCH}.tar.gz"
                TMP_TAR="/tmp/gitleaks_${DL_VER}.tar.gz"
                if curl -sSfL "$TAR_URL" -o "$TMP_TAR" 2>/dev/null; then
                    tar -xzf "$TMP_TAR" -C "$REPO_ROOT/.agents/bin" gitleaks 2>/dev/null || true
                    rm -f "$TMP_TAR"
                    if [ -x "$REPO_ROOT/.agents/bin/gitleaks" ]; then
                        chmod 755 "$REPO_ROOT/.agents/bin/gitleaks"
                        INSTALLED=1
                        echo "[ OK ] Standalone Gitleaks installed into .agents/bin/gitleaks."
                    fi
                fi
            fi
        fi
    fi
    if [ "$INSTALLED" -eq 0 ]; then
        echo "[ INFO ] Built-in Dev-OS secret scanner active as zero-dependency fallback."
    fi
fi

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

# 2. Secret Scanning via Gitleaks or Built-in Scanner
GITLEAKS_EXEC=""
if command -v gitleaks >/dev/null 2>&1; then
    GITLEAKS_EXEC="gitleaks"
elif [ -x ".agents/bin/gitleaks" ]; then
    GITLEAKS_EXEC=".agents/bin/gitleaks"
elif [ -n "$REPO_ROOT" ] && [ -x "$REPO_ROOT/.agents/bin/gitleaks" ]; then
    GITLEAKS_EXEC="$REPO_ROOT/.agents/bin/gitleaks"
fi

if [ -n "$GITLEAKS_EXEC" ]; then
    echo "[ INFO ] Scanning staged diff for hardcoded secrets with Gitleaks..."
    if ! "$GITLEAKS_EXEC" git --staged --verbose; then
        echo ""
        echo "[ FAIL ] GITLEAKS ERROR: Hardcoded secret or API key detected in staged files."
        echo "[ WARN ] Commit aborted to prevent secret leak."
        echo ""
        exit 1
    fi
    echo "[ OK ] Gitleaks secret scan clean."
else
    echo "[ INFO ] Running Dev-OS built-in secret scanner..."
    STAGED_DIFF=$(git diff --cached --unified=0 2>/dev/null || true)
    SECRET_PATTERN='(AKIA[0-9A-Z]{16}|ghp_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z_]{82}|sk-[0-9a-zA-Z]{32,}|sk-ant-[0-9a-zA-Z_-]{32,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AIza[0-9A-Za-z\-_]{35}|xox[baprs]-[0-9a-zA-Z]{10,48})'
    if echo "$STAGED_DIFF" | grep -E -q "$SECRET_PATTERN"; then
        echo ""
        echo "[ FAIL ] DEV-OS SECRET SCANNER ERROR: Hardcoded credentials or private keys detected in staged changes."
        echo "[ WARN ] Commit aborted to prevent secret leak."
        echo ""
        exit 1
    fi
    echo "[ OK ] Built-in secret scan clean."
fi

echo "[ OK ] Dev-OS pre-commit checks passed."
exit 0
EOF

chmod +x "$PRE_COMMIT_HOOK"

echo "[ OK ] Pre-commit hook successfully installed at: $PRE_COMMIT_HOOK"
