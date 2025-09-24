#!/usr/bin/env node

/**
 * Infrastructure Validation Script
 * Comprehensive validation of all infrastructure components
 */

const { execSync } = require('child_process');
const { Pool } = require('pg');
const fs = require('fs');

class InfrastructureValidator {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async run() {
    console.log('🔧 Infrastructure Validation Suite - REFACTOR Phase');
    console.log('Validating all components are working together\n');

    for (const { name, testFn } of this.tests) {
      try {
        await testFn();
        console.log(`✅ ${name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}\n`);
        this.failed++;
      }
    }

    console.log(`\n📊 Final Results: ${this.passed} passed, ${this.failed} failed`);
    if (this.failed === 0) {
      console.log('🎉 All infrastructure components are working perfectly!');
      console.log('✅ Ready for development');
    } else {
      console.log('⚠️  Some components need attention');
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  exec(command) {
    try {
      return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }
}

// Initialize test suite
const validator = new InfrastructureValidator();

// Test 1: Docker services are running
validator.test('Docker services are running and healthy', async () => {
  const output = validator.exec('docker-compose ps --format json');
  const services = JSON.parse(`[${output.trim().split('\n').join(',')}]`);

  const postgres = services.find(s => s.Service === 'postgres');
  validator.assert(postgres && postgres.State === 'running',
    'PostgreSQL service should be running');

  // Test health check
  const healthOutput = validator.exec('docker-compose exec postgres pg_isready -U postgres');
  validator.assert(healthOutput.includes('accepting connections'),
    'PostgreSQL should be accepting connections');
});

// Test 2: Database schema is properly migrated
validator.test('Database schema is properly migrated', async () => {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'keyfate_dev',
    user: 'postgres',
    password: 'dev_password_change_in_prod',
  });

  const client = await pool.connect();

  // Check required tables exist
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const tableNames = tables.rows.map(row => row.table_name);
  const requiredTables = [
    'admin_notifications', 'users', 'check_in_tokens',
    'checkin_history', 'secrets', 'subscription_tiers',
    'user_contact_methods', 'user_subscriptions', 'accounts',
    'sessions', 'verification_tokens', 'email_notifications',
    'reminder_jobs', 'cron_config'
  ];

  for (const table of requiredTables) {
    validator.assert(tableNames.includes(table),
      `Table '${table}' should exist`);
  }

  client.release();
  await pool.end();
});

// Test 3: Database is seeded with development data
validator.test('Database is seeded with development data', async () => {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'keyfate_dev',
    user: 'postgres',
    password: 'dev_password_change_in_prod',
  });

  const client = await pool.connect();

  // Check development users exist
  const users = await client.query('SELECT email FROM users ORDER BY email');
  const userEmails = users.rows.map(row => row.email);

  validator.assert(userEmails.includes('ceo@aviat.io'),
    'Development user ceo@aviat.io should exist');
  validator.assert(userEmails.some(email => email.includes('@example.com')),
    'Development test user should exist');

  // Check tiers table exists (may be empty in dev)
  const tiers = await client.query('SELECT COUNT(*) as count FROM subscription_tiers');
  validator.assert(tiers.rows[0].count >= 0, 'Subscription tiers table should be accessible');

  // Check secrets table exists (may be empty in dev)
  const secrets = await client.query('SELECT COUNT(*) as count FROM secrets');
  validator.assert(secrets.rows[0].count >= 0,
    'Secrets table should be accessible');

  client.release();
  await pool.end();
});

// Test 4: Environment configuration is correct
validator.test('Environment configuration is correct', () => {
  validator.assert(fs.existsSync('.env.local.example'),
    'Root .env.local.example should exist');
  validator.assert(fs.existsSync('frontend/.env.local.example'),
    'Frontend .env.local.example should exist');

  // Check environment files have required variables
  const rootEnv = fs.readFileSync('.env.local.example', 'utf8');
  validator.assert(rootEnv.includes('DATABASE_URL'),
    'Root env should include DATABASE_URL');
  validator.assert(rootEnv.includes('POSTGRES_DB'),
    'Root env should include POSTGRES_DB');

  const frontendEnv = fs.readFileSync('frontend/.env.local.example', 'utf8');
  validator.assert(frontendEnv.includes('DATABASE_URL'),
    'Frontend env should include DATABASE_URL');
  validator.assert(frontendEnv.includes('NEXT_PUBLIC_SITE_URL'),
    'Frontend env should include NEXT_PUBLIC_SITE_URL');
});

// Test 5: All Make commands are functional
validator.test('All Make commands are functional', () => {
  // Test help command
  const helpOutput = validator.exec('make help');
  validator.assert(helpOutput.includes('Available commands'),
    'Make help should show available commands');

  // Test status command
  const statusOutput = validator.exec('make status');
  validator.assert(statusOutput.includes('postgres'),
    'Make status should show postgres service');
});

// Test 6: Scripts are executable and working
validator.test('All scripts are executable and working', async () => {
  // Test database connection script
  const dbTestOutput = validator.exec('node scripts/test-db-connection.js');
  validator.assert(dbTestOutput.includes('All database tests passed'),
    'Database connection test should pass');

  // Test infrastructure test script
  const infraTestOutput = validator.exec('node test-infrastructure.js');
  validator.assert(infraTestOutput.includes('All tests passing'),
    'Infrastructure tests should pass');
});

// Test 7: Deployment scripts are ready
validator.test('Deployment scripts are ready', () => {
  validator.assert(fs.existsSync('scripts/deploy-staging.sh'),
    'Staging deployment script should exist');
  validator.assert(fs.existsSync('scripts/deploy-prod.sh'),
    'Production deployment script should exist');

  // Check scripts are executable
  const stagingStats = fs.statSync('scripts/deploy-staging.sh');
  const prodStats = fs.statSync('scripts/deploy-prod.sh');

  validator.assert((stagingStats.mode & parseInt('111', 8)) > 0,
    'Staging deployment script should be executable');
  validator.assert((prodStats.mode & parseInt('111', 8)) > 0,
    'Production deployment script should be executable');
});

// Test 8: Documentation is complete
validator.test('Documentation is complete and accurate', () => {
  validator.assert(fs.existsSync('INFRASTRUCTURE.md'),
    'Infrastructure documentation should exist');

  const docs = fs.readFileSync('INFRASTRUCTURE.md', 'utf8');
  validator.assert(docs.includes('Quick Start'),
    'Documentation should include Quick Start section');
  validator.assert(docs.includes('make install'),
    'Documentation should reference make install');
  validator.assert(docs.includes('make dev'),
    'Documentation should reference make dev');
});

// Run all validation tests
if (require.main === module) {
  validator.run().catch(console.error);
}

module.exports = { InfrastructureValidator };