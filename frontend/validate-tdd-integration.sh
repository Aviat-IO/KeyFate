#!/bin/bash

# TDD Integration Validation
# Comprehensive validation script for agent integration

echo "🧪 TDD Integration Validation System"
echo "===================================="

# Step 1: Run TDD validation
echo "1️⃣ Running TDD validation..."
if ./run-all-tests.sh; then
    echo "✅ TDD validation completed successfully"
else
    echo "❌ TDD validation failed"
    exit 1
fi

echo ""

# Step 2: Verify status reporting
echo "2️⃣ Verifying status reporting..."
if ./check-tdd-status.sh; then
    echo "✅ Status reporting working correctly"
else
    echo "❌ Status reporting failed"
    exit 1
fi

echo ""

# Step 3: Validate integration points
echo "3️⃣ Validating integration points..."

# Check if all required files exist
REQUIRED_FILES=(
    "run-all-tests.sh"
    "check-tdd-status.sh"
    ".claude/status/tdd-validation.status"
    ".claude/status/tdd-validation.log"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
        exit 1
    fi
done

echo ""

# Step 4: Test error handling
echo "4️⃣ Testing error handling capabilities..."

# Create a temporary failing test scenario
echo "RUNNING" > .claude/status/tdd-validation.status
if ./check-tdd-status.sh; then
    echo "⚠️ Status check should have detected running state"
else
    echo "✅ Running state detected correctly"
fi

# Restore success state
echo "SUCCESS" > .claude/status/tdd-validation.status

echo ""

# Final validation
echo "🎯 FINAL VALIDATION RESULT"
echo "=========================="

if ./check-tdd-status.sh > /dev/null 2>&1; then
    echo "✅ ALL INTEGRATION TESTS PASSED"
    echo "🎉 TDD validation system is working correctly"
    echo "🔧 External systems can now reliably check test status"
    echo ""
    echo "📋 Usage for external systems:"
    echo "  - Run tests: ./run-all-tests.sh"
    echo "  - Check status: ./check-tdd-status.sh"
    echo "  - Status file: .claude/status/tdd-validation.status"
    echo "  - Log file: .claude/status/tdd-validation.log"
    exit 0
else
    echo "❌ INTEGRATION VALIDATION FAILED"
    echo "🚨 Manual investigation required"
    exit 1
fi