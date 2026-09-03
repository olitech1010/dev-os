#!/bin/bash

# Dev-OS Human Checkpoint & Commit Script
# This script enforces conventional commits and requires a human approval token.

set -e

echo "======================================"
echo "    Dev-OS Commit & Checkpoint"
echo "======================================"
echo ""
echo "Code must pass QA and receive Human Approval before committing."
echo ""

# Helper: Prompt from controlling terminal (/dev/tty) to prevent piped stdin bypass
prompt_interactive() {
    local prompt="$1"
    local var_name="$2"
    if [ "$DEVOS_HEADLESS_COMMIT" = "1" ] || [ "$DEVOS_HEADLESS_COMMIT" = "true" ]; then
        read -p "$prompt" "$var_name"
    elif [ -r /dev/tty ]; then
        read -p "$prompt" "$var_name" < /dev/tty
    else
        echo ""
        echo "[ FAIL ] Error: Human approval requires an interactive terminal."
        echo "         Cannot read from /dev/tty (piped input is blocked by policy)."
        echo "         For authorized automated CI pipelines, export DEVOS_HEADLESS_COMMIT=1."
        echo ""
        exit 1
    fi
}

# 1. Enforce Human Checkpoint
if [ ! -r /dev/tty ] && [ "$DEVOS_HEADLESS_COMMIT" != "1" ] && [ "$DEVOS_HEADLESS_COMMIT" != "true" ]; then
    echo "[ FAIL ] Error: Human approval requires an interactive terminal."
    echo "         Cannot read from /dev/tty (piped input is blocked by policy)."
    echo "         For authorized automated CI pipelines, export DEVOS_HEADLESS_COMMIT=1."
    exit 1
fi

if [ "$DEVOS_HEADLESS_COMMIT" = "1" ] || [ "$DEVOS_HEADLESS_COMMIT" = "true" ]; then
    echo "[ WARN ] Headless commit authorized via DEVOS_HEADLESS_COMMIT."
fi

prompt_interactive "Human Approval Token (type 'approve' to proceed): " token

if [ "$token" != "approve" ]; then
    echo "[ FAIL ] Error: Invalid human approval token. Commit aborted."
    exit 1
fi

echo "[ OK ] Human approval verified."

# 2. Get Commit Details
prompt_interactive "Commit Type (feat, fix, docs, refactor, perf, style, test, chore): " commit_type
if [[ ! "$commit_type" =~ ^(feat|fix|docs|refactor|perf|style|test|chore)$ ]]; then
    echo "[ FAIL ] Error: Invalid commit type."
    exit 1
fi

prompt_interactive "Commit Message: " commit_message
if [ -z "$commit_message" ]; then
    echo "[ FAIL ] Error: Commit message cannot be empty."
    exit 1
fi

# 3. Execute Commit
export DEVOS_COMMIT_APPROVED=true
echo ""
echo "Executing: git commit -m \"$commit_type: $commit_message\""
git commit -m "$commit_type: $commit_message"

echo "[ OK ] Commit successful!"
