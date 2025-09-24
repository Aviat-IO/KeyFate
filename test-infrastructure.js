#!/usr/bin/env node

/**
 * Infrastructure Test Suite - TDD Red Phase
 * Tests the expected behavior of our local development infrastructure
 * These tests will fail initially (Red phase) until we implement the infrastructure
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class InfrastructureTest {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, testFn) {
    if (typeof name !== 'string') {
      throw new Error('Test name must be a string');
    }
    if (typeof testFn !== 'function') {
      throw new Error('Test function must be a function');
    }
    this.tests.push({ name, testFn });
  }

  async run() {
    console.log('🧪 Running Infrastructure Tests (TDD Red Phase)\n');

    for (const { name, testFn } of this.tests) {
      try {
        // Handle both sync and async test functions
        const result = testFn();
        if (result instanceof Promise) {
          await result;
        }
        console.log(`✅ ${name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}\n`);
        this.failed++;
      }
    }

    console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) {
      console.log('🔴 RED PHASE: Tests failing as expected - infrastructure needs implementation');
    } else {
      console.log('🟢 GREEN PHASE: All tests passing - infrastructure is working!');
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  fileExists(filePath) {
    if (typeof filePath !== 'string') {
      throw new Error('File path must be a string');
    }
    return fs.existsSync(filePath);
  }

  exec(command) {
    if (typeof command !== 'string') {
      throw new Error('Command must be a string');
    }
    try {
      const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
      return typeof result === 'string' ? result : String(result);
    } catch (error) {
      const errorMessage = error && typeof error === 'object' && 'message' in error
        ? error.message
        : 'Unknown error occurred';
      throw new Error(`Command failed: ${command}\n${errorMessage}`);
    }
  }
}

// Initialize test suite
const test = new InfrastructureTest();

// Test 1: Root Makefile exists with required commands
test.test('Root Makefile exists with required commands', () => {
  test.assert(test.fileExists('./Makefile'), 'Root Makefile should exist');

  const makefile = fs.readFileSync('./Makefile', 'utf8');
  test.assert(typeof makefile === 'string' && makefile.length > 0, 'Makefile should not be empty');
  test.assert(makefile.includes('install:'), 'Makefile should have install target');
  test.assert(makefile.includes('dev:'), 'Makefile should have dev target');
  test.assert(makefile.includes('deploy-staging:'), 'Makefile should have deploy-staging target');
  test.assert(makefile.includes('deploy-prod:'), 'Makefile should have deploy-prod target');
});

// Test 2: Docker Compose configuration exists
test.test('Docker Compose configuration exists for local development', () => {
  test.assert(test.fileExists('./docker-compose.yml'), 'docker-compose.yml should exist');

  const compose = fs.readFileSync('./docker-compose.yml', 'utf8');
  test.assert(typeof compose === 'string' && compose.length > 0, 'docker-compose.yml should not be empty');
  test.assert(compose.includes('postgres'), 'Should include postgres service');
  test.assert(compose.includes('volumes:'), 'Should include volume configuration');
  test.assert(compose.includes('environment:'), 'Should include environment variables');
});

// Test 3: Database migration setup
test.test('Database migration infrastructure exists', () => {
  test.assert(test.fileExists('./database/migrations'), 'Migration directory should exist');
  test.assert(test.fileExists('./database/seeds'), 'Seeds directory should exist');
  test.assert(test.fileExists('./scripts/migrate.js'), 'Migration script should exist');
});

// Test 4: Environment configuration files
test.test('Environment configuration files exist', () => {
  test.assert(test.fileExists('./.env.local.example'), 'Local env example should exist');
  test.assert(test.fileExists('./frontend/.env.local.example'), 'Frontend local env example should exist');
});

// Test 5: Make install command works
test.test('make install command works', () => {
  // This will fail initially but should work after implementation
  const output = test.exec('make install');
  test.assert(output.includes('installation complete') || output.includes('✅'),
    'make install should complete successfully');
});

// Test 6: Make dev command starts services
test.test('make dev command structure exists', () => {
  const makefile = fs.readFileSync('./Makefile', 'utf8');
  test.assert(typeof makefile === 'string' && makefile.length > 0, 'Makefile should be readable');
  test.assert(makefile.includes('docker-compose up'), 'dev target should start docker-compose');
  test.assert(makefile.includes('frontend'), 'dev target should reference frontend');
});

// Test 7: Database connection validation script
test.test('Database connection validation exists', () => {
  test.assert(test.fileExists('./scripts/test-db-connection.js'),
    'Database connection test script should exist');
});

// Test 8: Deployment configuration exists
test.test('Deployment configuration exists', () => {
  test.assert(test.fileExists('./deploy'), 'Deploy directory should exist');
  test.assert(test.fileExists('./scripts/deploy-staging.sh'), 'Staging deploy script should exist');
  test.assert(test.fileExists('./scripts/deploy-prod.sh'), 'Production deploy script should exist');
});

// Run the tests
test.run().catch(console.error);