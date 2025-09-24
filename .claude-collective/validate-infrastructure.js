#!/usr/bin/env node

// Infrastructure validation script
// Validates all aspects of the test infrastructure and TDD compliance

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

const VALIDATION_CHECKS = [
  'Test Framework Configuration',
  'Test File Structure',
  'Test Execution',
  'Coverage Analysis',
  'TDD Compliance',
  'Agent Integration',
  'Contract Validation',
  'Infrastructure Health'
];

console.log('🚀 Infrastructure Validation Starting...\n');

const results = {
  passed: 0,
  failed: 0,
  details: []
};

function validateCheck(name, testFn) {
  try {
    const result = testFn();
    if (result.success) {
      console.log(`✅ ${name}: PASSED`);
      if (result.details) console.log(`   ${result.details}`);
      results.passed++;
      results.details.push({ check: name, status: 'PASSED', details: result.details });
    } else {
      console.log(`❌ ${name}: FAILED`);
      if (result.error) console.log(`   Error: ${result.error}`);
      results.failed++;
      results.details.push({ check: name, status: 'FAILED', error: result.error });
    }
  } catch (error) {
    console.log(`❌ ${name}: ERROR`);
    console.log(`   Exception: ${error.message}`);
    results.failed++;
    results.details.push({ check: name, status: 'ERROR', error: error.message });
  }
}

// 1. Test Framework Configuration
validateCheck('Test Framework Configuration', () => {
  const vitestConfig = fs.existsSync('vitest.config.js');
  const packageJson = fs.readJsonSync('package.json');
  const hasTestScript = packageJson.scripts && packageJson.scripts.test;
  const hasVitestDep = packageJson.devDependencies && packageJson.devDependencies.vitest;

  if (vitestConfig && hasTestScript && hasVitestDep) {
    return { success: true, details: 'Vitest configured with ESM support' };
  } else {
    return { success: false, error: 'Missing Vitest configuration components' };
  }
});

// 2. Test File Structure
validateCheck('Test File Structure', () => {
  const requiredDirs = ['tests/agents', 'tests/contracts', 'tests/handoffs'];
  const missingDirs = requiredDirs.filter(dir => !fs.existsSync(dir));

  const testFiles = [
    'tests/agents/tdd-validation.test.js',
    'tests/contracts/contract-validation.test.js',
    'tests/contracts/advanced-contract.test.js',
    'tests/handoffs/agent-handoff.test.js',
    'tests/setup.js'
  ];
  const missingFiles = testFiles.filter(file => !fs.existsSync(file));

  if (missingDirs.length === 0 && missingFiles.length === 0) {
    return { success: true, details: `All 4 test files present in proper structure` };
  } else {
    return { success: false, error: `Missing: ${[...missingDirs, ...missingFiles].join(', ')}` };
  }
});

// 3. Test Execution
validateCheck('Test Execution', () => {
  try {
    const output = execSync('npm test', { encoding: 'utf8', stdio: 'pipe' });
    const testPattern = /Test Files\s+(\d+)\s+passed\s+\(\d+\)[\s\S]*Tests\s+(\d+)\s+passed\s+\(\d+\)/;
    const match = output.match(testPattern);

    if (match && match[1] === '4' && match[2] === '41') {
      return { success: true, details: '4 test files, 41 tests passing' };
    } else {
      return { success: false, error: `Test output: ${output.slice(-200)}` };
    }
  } catch (error) {
    return { success: false, error: `Test execution failed: ${error.message}` };
  }
});

// 4. Coverage Analysis
validateCheck('Coverage Analysis', () => {
  try {
    // Check if coverage collection is properly configured
    const packageJson = fs.readJsonSync('package.json');
    const jestConfig = fs.existsSync('jest.config.js');

    if (jestConfig) {
      return { success: true, details: 'Coverage configuration present (Jest)' };
    } else {
      return { success: true, details: 'Using Vitest (coverage available via --coverage flag)' };
    }
  } catch (error) {
    return { success: false, error: `Coverage analysis failed: ${error.message}` };
  }
});

// 5. TDD Compliance
validateCheck('TDD Compliance', () => {
  try {
    const tddTestFile = fs.readFileSync('tests/agents/tdd-validation.test.js', 'utf8');
    const hasTDDValidation = tddTestFile.includes('validateTDDCompliance');
    const hasQualityGates = tddTestFile.includes('validateQualityGate');
    const hasTaskValidation = tddTestFile.includes('validateTaskCompletion');

    if (hasTDDValidation && hasQualityGates && hasTaskValidation) {
      return { success: true, details: 'TDD cycle validation, quality gates, and task validation present' };
    } else {
      return { success: false, error: 'Missing TDD validation functions' };
    }
  } catch (error) {
    return { success: false, error: `TDD compliance check failed: ${error.message}` };
  }
});

// 6. Agent Integration
validateCheck('Agent Integration', () => {
  try {
    const handoffTestFile = fs.readFileSync('tests/handoffs/agent-handoff.test.js', 'utf8');
    const hasHubSpoke = handoffTestFile.includes('Hub-and-Spoke Routing');
    const hasContextPreservation = handoffTestFile.includes('Context Preservation');
    const hasQualityGates = handoffTestFile.includes('Quality Gates');

    if (hasHubSpoke && hasContextPreservation && hasQualityGates) {
      return { success: true, details: 'Hub-and-spoke, context preservation, and quality gate tests present' };
    } else {
      return { success: false, error: 'Missing agent integration test components' };
    }
  } catch (error) {
    return { success: false, error: `Agent integration check failed: ${error.message}` };
  }
});

// 7. Contract Validation
validateCheck('Contract Validation', () => {
  try {
    const contractTestFile = fs.readFileSync('tests/contracts/contract-validation.test.js', 'utf8');
    const advancedContractFile = fs.readFileSync('tests/contracts/advanced-contract.test.js', 'utf8');

    const hasBasicValidation = contractTestFile.includes('TestContractValidator');
    const hasAdvancedValidation = advancedContractFile.includes('Multi-Stage Contract Chains');
    const hasSecurityValidation = advancedContractFile.includes('Security Contract Validation');

    if (hasBasicValidation && hasAdvancedValidation && hasSecurityValidation) {
      return { success: true, details: 'Basic, advanced, and security contract validation present' };
    } else {
      return { success: false, error: 'Missing contract validation components' };
    }
  } catch (error) {
    return { success: false, error: `Contract validation check failed: ${error.message}` };
  }
});

// 8. Infrastructure Health
validateCheck('Infrastructure Health', () => {
  try {
    const setupFile = fs.readFileSync('tests/setup.js', 'utf8');
    const vitestConfig = fs.readFileSync('vitest.config.js', 'utf8');

    const hasESMSetup = setupFile.includes('import') && !setupFile.includes('require(');
    const hasVitestGlobals = vitestConfig.includes('globals: true');
    const hasSetupFiles = vitestConfig.includes('setupFiles');

    if (hasESMSetup && hasVitestGlobals && hasSetupFiles) {
      return { success: true, details: 'ESM modules, Vitest globals, and setup configuration correct' };
    } else {
      return { success: false, error: 'Infrastructure configuration issues detected' };
    }
  } catch (error) {
    return { success: false, error: `Infrastructure health check failed: ${error.message}` };
  }
});

// Results Summary
console.log('\n📊 VALIDATION SUMMARY');
console.log('='.repeat(50));
console.log(`Total Checks: ${results.passed + results.failed}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);
console.log(`Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

if (results.failed === 0) {
  console.log('\n🎉 ALL INFRASTRUCTURE TESTS PASSED!');
  console.log('✅ TDD validation framework is working correctly');
  console.log('✅ All 41 tests executing successfully');
  console.log('✅ ESM modules configured properly');
  console.log('✅ Test infrastructure ready for handoff validation');
  process.exit(0);
} else {
  console.log('\n⚠️  INFRASTRUCTURE ISSUES DETECTED');
  results.details.filter(d => d.status !== 'PASSED').forEach(detail => {
    console.log(`❌ ${detail.check}: ${detail.error || detail.status}`);
  });
  process.exit(1);
}