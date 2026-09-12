#!/usr/bin/env bash

# Dev-OS Humanizer Mechanical Scanner
# Audits markdown files for AI writing tells and forbidden robotic fluff.
# Based on blader/humanizer (https://github.com/blader/humanizer)

TARGET_FILE="$1"

if [ -z "$TARGET_FILE" ]; then
    echo "Usage: .agents/scripts/humanize-check.sh <markdown_file>"
    exit 1
fi

if [ -d "$TARGET_FILE" ]; then
    echo "🔍 Auditing directory '$TARGET_FILE' for AI writing patterns..."
    DIR_FAILURES=0
    for f in "$TARGET_FILE"/*.md; do
        [ -e "$f" ] || continue
        bash "$0" "$f" || DIR_FAILURES=$((DIR_FAILURES + 1))
    done
    if [ "$DIR_FAILURES" -gt 0 ]; then
        echo "❌ Humanizer Audit: Found AI tells across $DIR_FAILURES document(s)."
        exit 1
    fi
    echo "✅ Humanizer Audit: All documents in '$TARGET_FILE' are clean!"
    exit 0
fi

if [ ! -f "$TARGET_FILE" ]; then
    echo "Error: File '$TARGET_FILE' does not exist."
    exit 1
fi

FAILURES=0

echo "🔍 Auditing '$TARGET_FILE' for AI writing patterns..."

# 1. Check for banned fluff words
BANNED_WORDS='delve|deep dive|crucial|pivotal|tapestry|stands as a testament|groundbreaking|nestled in|game-changer|revolutionize|meticulously'
MATCHES=$(grep -Ein "\b($BANNED_WORDS)\b" "$TARGET_FILE" | grep -v "^[[:space:]]*#" | grep -v "\`" | head -n 5)

if [ -n "$MATCHES" ]; then
    echo "  ⚠️ [TELL §11/§12] Overused AI words / inflated significance detected:"
    echo "$MATCHES" | sed 's/^/    Line /'
    FAILURES=$((FAILURES + 1))
fi

# 2. Check for chatbot residues
CHATBOT_PATTERNS="I hope this helps|Certainly!|Certainly,|Great question!|Let me know if you need anything else|without further ado"
MATCHES=$(grep -Ein "($CHATBOT_PATTERNS)" "$TARGET_FILE" | grep -v "\`" | head -n 5)

if [ -n "$MATCHES" ]; then
    echo "  ❌ [TELL §22] Chatbot residue detected:"
    echo "$MATCHES" | sed 's/^/    Line /'
    FAILURES=$((FAILURES + 1))
fi

# 3. Check for dramatic one-line closers
DRAMATIC_CLOSERS="That is the real win|Read that again|Let that sink in|The old rules were gone"
MATCHES=$(grep -Ein "($DRAMATIC_CLOSERS)" "$TARGET_FILE" | grep -v "\`" | head -n 5)

if [ -n "$MATCHES" ]; then
    echo "  ❌ [TELL §2] Dramatic one-line closer detected:"
    echo "$MATCHES" | sed 's/^/    Line /'
    FAILURES=$((FAILURES + 1))
fi

# 4. Check for staged run-ups
STAGED_RUNUPS="Let's dive in|Here's what you need to know|Here's the thing|Let's break this down"
MATCHES=$(grep -Ein "($STAGED_RUNUPS)" "$TARGET_FILE" | grep -v "\`" | head -n 5)

if [ -n "$MATCHES" ]; then
    echo "  ⚠️ [TELL §4] Staged run-up detected:"
    echo "$MATCHES" | sed 's/^/    Line /'
    FAILURES=$((FAILURES + 1))
fi

if [ "$FAILURES" -gt 0 ]; then
    echo ""
    echo "⚠️ Humanizer Audit: Found $FAILURES issue category/categories."
    echo "   Remediation: Apply skill '.agents/skills/humanizer/SKILL.md' to de-fluff."
    exit 1
else
    echo "✅ Humanizer Audit: Clean! No robotic AI writing tells detected."
    exit 0
fi
