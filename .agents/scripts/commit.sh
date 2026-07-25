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

# 1. Enforce Human Checkpoint
read -p "Human Approval Token (type 'approve' to proceed): " token

if [ "$token" != "approve" ]; then
    echo "❌ Error: Invalid human approval token. Commit aborted."
    exit 1
fi

echo "✅ Human approval verified."

# 2. Get Commit Details
read -p "Commit Type (feat, fix, docs, refactor, test, chore): " commit_type
if [[ ! "$commit_type" =~ ^(feat|fix|docs|refactor|test|chore)$ ]]; then
    echo "❌ Error: Invalid commit type."
    exit 1
fi

read -p "Commit Message: " commit_message
if [ -z "$commit_message" ]; then
    echo "❌ Error: Commit message cannot be empty."
    exit 1
fi

# 3. Execute Commit
echo ""
echo "Executing: git commit -m \"$commit_type: $commit_message\""
git commit -m "$commit_type: $commit_message"

echo "✅ Commit successful!"
