#!/bin/bash

# Dev-OS Git Hooks Installer
# Installs mechanical pre-commit hooks to enforce gitleaks secret scanning and the Dev-OS commit gate,
# plus a pre-merge-commit hook. Both refuse to run from AI agent shells (CLAUDECODE, GEMINI_CLI, ...).
# The opt-in standalone Gitleaks download is verified against a pinned sha256 and the release's
# published checksum file; .agents/bin/ is added to .gitignore when the binary is installed.

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

# Gitleaks: detect only by default (no network, no package manager).
#   DEVOS_INSTALL_GITLEAKS=1  install (if missing) or upgrade via Homebrew, snap, or a pinned GitHub release
#   DEVOS_OFFLINE=1           never touch the network, even with DEVOS_INSTALL_GITLEAKS=1
GITLEAKS_FOUND=""
if command -v gitleaks >/dev/null 2>&1; then
    GITLEAKS_FOUND="$(command -v gitleaks)"
elif [ -x "$REPO_ROOT/.agents/bin/gitleaks" ]; then
    GITLEAKS_FOUND="$REPO_ROOT/.agents/bin/gitleaks"
fi

INSTALL_GITLEAKS="0"
if [ "$DEVOS_INSTALL_GITLEAKS" = "1" ] || [ "$DEVOS_INSTALL_GITLEAKS" = "true" ]; then
    INSTALL_GITLEAKS="1"
fi
if [ "$INSTALL_GITLEAKS" = "1" ] && [ "$DEVOS_OFFLINE" = "1" ]; then
    echo "[ WARN ] Gitleaks install/upgrade skipped (offline: DEVOS_OFFLINE=1)."
    INSTALL_GITLEAKS="0"
fi

if [ -n "$GITLEAKS_FOUND" ]; then
    GL_VER=$("$GITLEAKS_FOUND" version 2>/dev/null | head -n 1)
    echo "[ OK ] Gitleaks detected: $GITLEAKS_FOUND (${GL_VER:-version unknown})"
    if [ "$INSTALL_GITLEAKS" = "1" ] && command -v brew >/dev/null 2>&1; then
        if HOMEBREW_NO_AUTO_UPDATE=1 brew outdated gitleaks 2>/dev/null | grep -q "gitleaks"; then
            echo "[ INFO ] Upgrading Gitleaks via Homebrew..."
            HOMEBREW_NO_AUTO_UPDATE=1 brew upgrade gitleaks >/dev/null 2>&1 || echo "[ WARN ] brew upgrade gitleaks failed."
        fi
    fi
elif [ "$INSTALL_GITLEAKS" != "1" ]; then
    echo "[ WARN ] Gitleaks not found. The built-in Dev-OS secret scanner will be used as a fallback."
    echo "         Install hint: brew install gitleaks (macOS) | https://github.com/gitleaks/gitleaks#installing"
    echo "         Or re-run with DEVOS_INSTALL_GITLEAKS=1 (devos init --install-gitleaks)."
else
    echo "[ INFO ] Gitleaks not found. Installing (DEVOS_INSTALL_GITLEAKS=1)..."
    INSTALLED=0
    if command -v brew >/dev/null 2>&1; then
        echo "[ INFO ] Installing Gitleaks via Homebrew..."
        if HOMEBREW_NO_AUTO_UPDATE=1 brew install gitleaks >/dev/null 2>&1; then
            INSTALLED=1
            echo "[ OK ] Gitleaks installed successfully via Homebrew."
        fi
    fi
    # Non-interactive only: never prompt for a sudo password.
    if [ "$INSTALLED" -eq 0 ] && command -v snap >/dev/null 2>&1; then
        echo "[ INFO ] Installing Gitleaks via snap..."
        if snap install gitleaks >/dev/null 2>&1 || sudo -n snap install gitleaks >/dev/null 2>&1; then
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
        if { [ "$OS" = "darwin" ] || [ "$OS" = "linux" ]; } && [ -n "$ARCH" ]; then
            echo "[ INFO ] Downloading standalone Gitleaks binary from GitHub..."
            DL_VER="8.30.1"
            ASSET="gitleaks_${DL_VER}_${OS}_${ARCH}.tar.gz"
            BASE_URL="https://github.com/gitleaks/gitleaks/releases/download/v${DL_VER}"
            # Pinned sha256 for v8.30.1 (from gitleaks_8.30.1_checksums.txt). The download must match
            # both this pin and the checksum file published with the release.
            case "${OS}_${ARCH}" in
                darwin_arm64) PINNED_SHA="b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5" ;;
                darwin_x64)   PINNED_SHA="dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709" ;;
                linux_arm64)  PINNED_SHA="e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080" ;;
                linux_x64)    PINNED_SHA="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb" ;;
                *)            PINNED_SHA="" ;;
            esac
            SHA_CMD=""
            if command -v sha256sum >/dev/null 2>&1; then
                SHA_CMD="sha256sum"
            elif command -v shasum >/dev/null 2>&1; then
                SHA_CMD="shasum -a 256"
            fi
            TMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t devos-gitleaks)
            if [ -z "$SHA_CMD" ]; then
                echo "[ FAIL ] No sha256sum or shasum available; refusing to install an unverified Gitleaks binary."
            elif [ -n "$TMP_DIR" ] \
                && curl -sSfL --max-time 60 "$BASE_URL/$ASSET" -o "$TMP_DIR/$ASSET" 2>/dev/null \
                && curl -sSfL --max-time 30 "$BASE_URL/gitleaks_${DL_VER}_checksums.txt" -o "$TMP_DIR/checksums.txt" 2>/dev/null; then
                ACTUAL_SHA=$($SHA_CMD "$TMP_DIR/$ASSET" | awk '{print $1}')
                PUBLISHED_SHA=$(awk -v a="$ASSET" '$2 == a || $2 == "*" a {print $1}' "$TMP_DIR/checksums.txt" | head -n 1)
                if [ -z "$ACTUAL_SHA" ] || [ "$ACTUAL_SHA" != "$PUBLISHED_SHA" ] || { [ -n "$PINNED_SHA" ] && [ "$ACTUAL_SHA" != "$PINNED_SHA" ]; }; then
                    echo "[ FAIL ] Gitleaks checksum mismatch for $ASSET; aborting the install."
                    echo "         downloaded: ${ACTUAL_SHA:-none}  published: ${PUBLISHED_SHA:-none}  pinned: ${PINNED_SHA:-none}"
                else
                    echo "[ OK ] Gitleaks archive sha256 verified ($ACTUAL_SHA)."
                    mkdir -p "$TMP_DIR/x" "$REPO_ROOT/.agents/bin"
                    if tar -xzf "$TMP_DIR/$ASSET" -C "$TMP_DIR/x" gitleaks 2>/dev/null && [ -f "$TMP_DIR/x/gitleaks" ]; then
                        mv -f "$TMP_DIR/x/gitleaks" "$REPO_ROOT/.agents/bin/gitleaks"
                        chmod 755 "$REPO_ROOT/.agents/bin/gitleaks"
                        INSTALLED=1
                        echo "[ OK ] Standalone Gitleaks installed into .agents/bin/gitleaks."
                        # The binary is machine-specific: keep it out of version control.
                        GITIGNORE="$REPO_ROOT/.gitignore"
                        if ! grep -Eqx '/?\.agents/bin/?' "$GITIGNORE" 2>/dev/null; then
                            printf '\n# Dev-OS local tool binaries (gitleaks)\n.agents/bin/\n' >> "$GITIGNORE"
                            echo "[ OK ] Added .agents/bin/ to .gitignore."
                        fi
                    fi
                fi
            else
                echo "[ WARN ] Gitleaks download failed (archive or checksum file)."
            fi
            [ -n "$TMP_DIR" ] && rm -f "$TMP_DIR/$ASSET" "$TMP_DIR/checksums.txt" "$TMP_DIR/x/gitleaks" \
                && { rmdir "$TMP_DIR/x" 2>/dev/null || true; rmdir "$TMP_DIR" 2>/dev/null || true; }
        fi
    fi
    if [ "$INSTALLED" -eq 0 ]; then
        echo "[ WARN ] Gitleaks installation failed. The built-in Dev-OS secret scanner will be used as a fallback."
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

# Run every check from the repository root so relative script paths resolve.
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
[ -n "$REPO_ROOT" ] && cd "$REPO_ROOT"

# 0. AI agent shells may not commit. The one exception is commit.sh's --agent path in Claude Code
#    with commitPolicy "agent" in .agents/manifest.json: there the human approved the command in
#    the Claude Code permission prompt, and commit.sh sets DEVOS_AGENT_COMMIT=1. Keep the marker
#    list in sync with AGENT_MARKERS in .agents/scripts/commit.sh and .agents/hooks/lib/hook-input.js.
DEVOS_AGENT_OK=0
if [ "$DEVOS_AGENT_COMMIT" = "1" ] && [ "$DEVOS_COMMIT_APPROVED" = "true" ] && [ -n "$CLAUDECODE" ] \
    && [ -f ".agents/manifest.json" ] \
    && grep -Eq '"commitPolicy"[[:space:]]*:[[:space:]]*"agent"' ".agents/manifest.json"; then
    DEVOS_AGENT_OK=1
fi
for DEVOS_MARKER in CLAUDECODE CLAUDE_CODE_ENTRYPOINT GEMINI_CLI CODEX_SANDBOX CODEX_SANDBOX_NETWORK_DISABLED CODEX_THREAD_ID CURSOR_AGENT AI_AGENT; do
    [ -n "${!DEVOS_MARKER}" ] || continue
    case "$DEVOS_MARKER" in
        CLAUDECODE|CLAUDE_CODE_ENTRYPOINT|AI_AGENT) [ "$DEVOS_AGENT_OK" = "1" ] && continue ;;
    esac
    echo ""
    echo "[ FAIL ] DEV-OS GATE ERROR: commit attempted from an AI agent shell ($DEVOS_MARKER is set)."
    echo "-> Present the changes for human review; the human commits via '.agents/scripts/commit.sh' from their own terminal."
    echo "   (Claude Code with 'devos commit-policy agent': .agents/scripts/commit.sh --agent \"<message>\")"
    echo ""
    exit 1
done

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
fi

if [ -n "$GITLEAKS_EXEC" ]; then
    echo "[ INFO ] Scanning staged diff for hardcoded secrets with Gitleaks..."
    # --redact keeps any detected secret value out of the terminal and CI logs.
    if ! "$GITLEAKS_EXEC" git --staged --redact --verbose; then
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

# 3. Environment & Config Parity Scan (Layer 2 Gate)
if [ -x ".agents/scripts/env-check.sh" ]; then
    if ! bash ".agents/scripts/env-check.sh" "."; then
        echo ""
        echo "[ FAIL ] Dev-OS Layer 2 Gate Violation: Environment variable parity check failed."
        exit 1
    fi
fi

# 4. Database & Migration Safety Scan (Layer 3 Gate)
if [ -x ".agents/scripts/db-check.sh" ]; then
    if git diff --cached --name-only | grep -q '\.sql$'; then
        if ! bash ".agents/scripts/db-check.sh" "."; then
            echo ""
            echo "[ FAIL ] Dev-OS Layer 3 Gate Violation: Database migration safety check failed."
            exit 1
        fi
    fi
fi

# 5. Anti-AI UI Taste Scan (Layer 2 Gate)
if [ -x ".agents/scripts/ui-taste-check.sh" ]; then
    if git diff --cached --name-only | grep -Eq '\.(tsx|jsx|vue|svelte|html)$'; then
        if ! bash ".agents/scripts/ui-taste-check.sh" "."; then
            echo ""
            echo "[ FAIL ] Dev-OS UI Taste Gate Violation: AI UI anti-pattern detected."
            exit 1
        fi
    fi
fi

# 6. Humanizer Documentation Scan (Layer 2 Gate)
if [ -x ".agents/scripts/humanize-check.sh" ]; then
    STAGED_DOCS=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '^docs/.*\.md$' || true)
    while IFS= read -r doc; do
        [ -n "$doc" ] && [ -f "$doc" ] || continue
        if ! bash ".agents/scripts/humanize-check.sh" "$doc"; then
            echo ""
            echo "[ FAIL ] Dev-OS Humanizer Gate Violation: Robotic AI writing detected in $doc."
            exit 1
        fi
    done <<DOCS
$STAGED_DOCS
DOCS
fi

echo "[ OK ] Dev-OS pre-commit checks passed."
exit 0
EOF

chmod +x "$PRE_COMMIT_HOOK"

echo "[ OK ] Pre-commit hook successfully installed at: $PRE_COMMIT_HOOK"

# pre-merge-commit: merge commits skip pre-commit, so refuse them from agent shells here.
# Humans can still merge normally (no approval token is required for merges).
PRE_MERGE_HOOK="$HOOKS_DIR/pre-merge-commit"
if [ -f "$PRE_MERGE_HOOK" ] && ! grep -q "Dev-OS" "$PRE_MERGE_HOOK"; then
    BACKUP_PATH="$PRE_MERGE_HOOK.backup.$(date +%Y%m%d%H%M%S)"
    cp "$PRE_MERGE_HOOK" "$BACKUP_PATH"
    echo "[ WARN ] Existing non-Dev-OS pre-merge-commit hook detected. Backed it up to: $BACKUP_PATH"
fi
cat << 'EOF' > "$PRE_MERGE_HOOK"
#!/bin/bash

# Dev-OS Pre-Merge-Commit Gate: AI agent shells cannot create merge commits.
for DEVOS_MARKER in CLAUDECODE CLAUDE_CODE_ENTRYPOINT GEMINI_CLI CODEX_SANDBOX CODEX_SANDBOX_NETWORK_DISABLED CODEX_THREAD_ID CURSOR_AGENT AI_AGENT; do
    if [ -n "${!DEVOS_MARKER}" ]; then
        echo "[ FAIL ] DEV-OS GATE ERROR: merge commit attempted from an AI agent shell ($DEVOS_MARKER is set)."
        echo "-> Ask the human to perform the merge."
        exit 1
    fi
done
exit 0
EOF
chmod +x "$PRE_MERGE_HOOK"
echo "[ OK ] Pre-merge-commit hook installed at: $PRE_MERGE_HOOK"
