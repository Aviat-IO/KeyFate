#!/bin/bash

# TDD Test Runner for KeyFate Frontend
# Runs complete test suite for validation

echo "🧪 Running TDD Test Suite..."
echo "Working Directory: $(pwd)"
echo "Test Framework: Vitest"
echo "Timestamp: $(date)"

# Create status directory if it doesn't exist
mkdir -p .claude/status

# Write initial status
echo "RUNNING" > .claude/status/tdd-validation.status

# Run the test suite and capture both exit code and output
echo "📝 Executing test command: npm test"
set +e  # Allow command to fail so we can capture exit code
npm test
TEST_EXIT_CODE=$?
set -e  # Re-enable exit on error

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ TEST EXECUTION SUCCESSFUL - Exit code: $TEST_EXIT_CODE"
else
    echo "❌ TEST EXECUTION FAILED - Exit code: $TEST_EXIT_CODE"
fi

echo "🔍 Final validation check..."

# Enhanced validation with detailed reporting
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ ALL TESTS PASSED - TDD VALIDATION SUCCESSFUL"
    echo "🎯 Validation Status: PASS"
    echo "📊 Exit Code: $TEST_EXIT_CODE"
    echo "⏰ Completed at: $(date)"

    # Write success status for external systems
    echo "SUCCESS" > .claude/status/tdd-validation.status
    echo "$(date): TDD validation successful - all tests passed" >> .claude/status/tdd-validation.log

    exit 0
else
    echo "❌ TESTS FAILED - TDD VALIDATION FAILED"
    echo "🎯 Validation Status: FAIL"
    echo "📊 Exit Code: $TEST_EXIT_CODE"
    echo "⏰ Failed at: $(date)"

    # Write failure status for external systems
    echo "FAILED" > .claude/status/tdd-validation.status
    echo "$(date): TDD validation failed - exit code $TEST_EXIT_CODE" >> .claude/status/tdd-validation.log

    exit 1
fi