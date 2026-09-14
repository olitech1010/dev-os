#!/usr/bin/env bash

# Dev-OS Anti-AI UI & Distinctive Craft Mechanical Scanner
# Audits frontend files (*.tsx, *.jsx, *.vue, *.svelte, *.html) for low-effort AI-generated UI clichés ("AI slop").
# Enforces Hard Rule #19 and .agents/skills/anti-ai-ui/SKILL.md

TARGET="$1"

if [ -z "$TARGET" ]; then
    TARGET="."
fi

# Print Header
echo "🎨 Dev-OS UI Taste & Anti-Slop Audit: Scanning '$TARGET'..."

# Temporary directory for findings
TOTAL_VIOLATIONS=0
SCANNED_FILES=0

audit_file() {
    local file="$1"
    local file_failures=0
    local filename
    filename=$(basename "$file")

    # Skip non-UI files, build outputs, node_modules, and test files
    case "$file" in
        *node_modules*|*.git*|*dist*|*build*|*.next*|*_backup*|*DESIGN.md|*.test.*|*.spec.*|*smoke-test*)
            return 0
            ;;
    esac

    case "$file" in
        *.tsx|*.jsx|*.vue|*.svelte|*.html)
            ;;
        *)
            return 0
            ;;
    esac

    SCANNED_FILES=$((SCANNED_FILES + 1))

    # 1. Check for Emojis in UI templates
    local emoji_matches
    emoji_matches=$(python3 -c "
import sys, re
emoji_pattern = re.compile(r'[\U0001F300-\U0001FAFF\u2600-\u26FF\u2700-\u27BF]')
with open(sys.argv[1], 'r', encoding='utf-8', errors='ignore') as f:
    for i, line in enumerate(f, 1):
        # ignore comments
        clean = line.strip()
        if clean.startswith('//') or clean.startswith('/*') or clean.startswith('*'):
            continue
        matches = emoji_pattern.findall(line)
        if matches:
            print(f'{i}: {\" \".join(matches)} -> {clean[:80]}')
" "$file" 2>/dev/null)

    if [ -n "$emoji_matches" ]; then
        echo "  ❌ [SLOP §1] Raw emojis used as functional UI elements in $file:"
        echo "$emoji_matches" | sed 's/^/      Line /' | head -n 4
        file_failures=$((file_failures + 1))
    fi

    # 2. Check for Sparkle Cliché (<Sparkles, Wand2, magic wand)
    local sparkle_matches
    sparkle_matches=$(grep -Ein "(<Sparkles\b|lucide-react.*Sparkles|<Wand2\b|magic-wand)" "$file" | grep -v "^[[:space:]]*//")
    if [ -n "$sparkle_matches" ]; then
        echo "  ❌ [SLOP §2] Sparkle / Magic Wand cliché detected in $file:"
        echo "$sparkle_matches" | sed 's/^/      Line /' | head -n 3
        file_failures=$((file_failures + 1))
    fi

    # 3. Check for Overused AI Indigo-Purple Gradients
    local gradient_matches
    gradient_matches=$(grep -Ein "(from-indigo-500.*to-purple-600|from-purple-500.*to-pink-500|from-violet-500.*to-fuchsia-500|from-indigo-600.*to-purple-600)" "$file")
    if [ -n "$gradient_matches" ]; then
        echo "  ⚠️ [SLOP §4] Cliché indigo-purple gradient detected in $file:"
        echo "$gradient_matches" | sed 's/^/      Line /' | head -n 3
        file_failures=$((file_failures + 1))
    fi

    # 4. Check for Cliché AI Hero Marketing Buzzwords
    local buzz_matches
    buzz_matches=$(grep -Ein "(all-in-one platform|supercharge your|unleash the power|streamline your workflow|blazing fast performance)" "$file" | grep -v "^[[:space:]]*//")
    if [ -n "$buzz_matches" ]; then
        echo "  ⚠️ [SLOP §7] Generic AI marketing buzzwords detected in $file:"
        echo "$buzz_matches" | sed 's/^/      Line /' | head -n 3
        file_failures=$((file_failures + 1))
    fi

    # 5. Check for Lazy Placeholder Data
    local placeholder_matches
    placeholder_matches=$(grep -Ein "\b(John Doe|john@example\.com|Acme Inc|Acme Corp|Lorem ipsum dolor)\b" "$file" | grep -v "^[[:space:]]*//")
    if [ -n "$placeholder_matches" ]; then
        echo "  ⚠️ [SLOP §13] Lazy placeholder entities detected in $file (use authentic domain entities):"
        echo "$placeholder_matches" | sed 's/^/      Line /' | head -n 3
        file_failures=$((file_failures + 1))
    fi

    # 6. Check for Accessible Focus Rings (focus:outline-none without focus-visible ring)
    local outline_matches
    outline_matches=$(grep -Ein "\b(focus:outline-none|outline-none)\b" "$file" | grep -Ev "focus-visible:(ring|border|outline)")
    if [ -n "$outline_matches" ]; then
        echo "  ❌ [A11Y §10] Outline suppressed without focus-visible replacement in $file:"
        echo "$outline_matches" | sed 's/^/      Line /' | head -n 3
        file_failures=$((file_failures + 1))
    fi

    if [ "$file_failures" -gt 0 ]; then
        TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + file_failures))
    fi
}

if [ -f "$TARGET" ]; then
    audit_file "$TARGET"
elif [ -d "$TARGET" ]; then
    # Scan directory recursively
    while IFS= read -r -d '' f; do
        audit_file "$f"
    done < <(find "$TARGET" -type f \( -name "*.tsx" -o -name "*.jsx" -o -name "*.vue" -o -name "*.svelte" -o -name "*.html" \) -print0)
else
    echo "Error: Target '$TARGET' not found."
    exit 1
fi

if [ "$SCANNED_FILES" -eq 0 ]; then
    echo "ℹ️ No frontend template files (*.tsx, *.jsx, *.vue, *.svelte, *.html) found to audit."
    echo "✅ UI Taste Audit: Clean (0 files inspected)."
    exit 0
fi

if [ "$TOTAL_VIOLATIONS" -gt 0 ]; then
    echo ""
    echo "❌ UI Taste Audit Failed: $TOTAL_VIOLATIONS AI UI anti-pattern violation(s) across $SCANNED_FILES scanned file(s)."
    echo "   Remediation:"
    echo "     1. Review .agents/skills/anti-ai-ui/SKILL.md for distinctive counter-patterns."
    echo "     2. Replace raw emojis with SVG vector icons (Lucide / Heroicons)."
    echo "     3. Remove sparkle embellishments and lazy indigo/purple gradients."
    echo "     4. Replace placeholder text ('John Doe') with authentic domain entities."
    echo "     5. Ensure all interactive buttons/inputs have focus-visible rings and tactile states."
    exit 1
else
    echo "✅ UI Taste Audit Passed: All $SCANNED_FILES frontend file(s) are clean, distinctive, and craft-compliant!"
    exit 0
fi
