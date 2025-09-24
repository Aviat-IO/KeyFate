#!/bin/bash

# TDD Status Checker
# Utility to check the current TDD validation status for external systems

STATUS_FILE=".claude/status/tdd-validation.status"
LOG_FILE=".claude/status/tdd-validation.log"

echo "🔍 Checking TDD Validation Status..."

if [ ! -f "$STATUS_FILE" ]; then
    echo "❌ No TDD validation status found - run ./run-all-tests.sh first"
    exit 1
fi

STATUS=$(cat "$STATUS_FILE")
echo "📊 Current Status: $STATUS"

if [ "$STATUS" = "SUCCESS" ]; then
    echo "✅ TDD VALIDATION: PASSED"
    if [ -f "$LOG_FILE" ]; then
        echo "📝 Last validation:"
        tail -1 "$LOG_FILE"
    fi
    echo "🎯 All systems go - validation successful!"
    exit 0
elif [ "$STATUS" = "FAILED" ]; then
    echo "❌ TDD VALIDATION: FAILED"
    if [ -f "$LOG_FILE" ]; then
        echo "📝 Last validation:"
        tail -1 "$LOG_FILE"
    fi
    echo "🚨 Action required - fix tests and re-run validation"
    exit 1
elif [ "$STATUS" = "RUNNING" ]; then
    echo "🔄 TDD VALIDATION: IN PROGRESS"
    echo "⏳ Please wait for validation to complete..."
    exit 2
else
    echo "⚠️ TDD VALIDATION: UNKNOWN STATUS ($STATUS)"
    echo "🔧 Manual investigation required"
    exit 3
fi