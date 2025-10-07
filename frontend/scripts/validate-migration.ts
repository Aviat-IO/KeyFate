#!/usr/bin/env ts-node

/**
 * Cloud SQL Migration Validation Script
 *
 * Validates all Cloud SQL migration components and configurations
 * Run this script after migration to ensure everything is working correctly
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.production.local') });
dotenv.config({ path: path.join(process.cwd(), '.env.production') });
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

interface ValidationResult {
  category: string;
  test: string;
  passed: boolean;
  message: string;
  details?: any;
}

class MigrationValidator {
  private pool: Pool;
  private results: ValidationResult[] = [];

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
  }

  private addResult(category: string, test: string, passed: boolean, message: string, details?: any) {
    this.results.push({ category, test, passed, message, details });
  }

  async validateConnection(): Promise<void> {
    console.log('\n=== Validating Database Connection ===');

    try {
      const client = await this.pool.connect();
      this.addResult('Connection', 'Database Connection', true, 'Successfully connected to Cloud SQL');
      client.release();
    } catch (error: any) {
      this.addResult('Connection', 'Database Connection', false, `Failed to connect: ${error.message}`, error);
    }

    try {
      const result = await this.pool.query('SHOW server_version');
      const version = result.rows[0].server_version;
      this.addResult('Connection', 'PostgreSQL Version', true, `PostgreSQL ${version}`, { version });
    } catch (error: any) {
      this.addResult('Connection', 'PostgreSQL Version', false, `Failed to get version: ${error.message}`, error);
    }

    try {
      const result = await this.pool.query("SHOW ssl");
      const sslEnabled = result.rows[0].ssl === 'on';
      this.addResult(
        'Connection',
        'SSL Encryption',
        sslEnabled,
        sslEnabled ? 'SSL is enabled' : 'WARNING: SSL is not enabled',
        { ssl: result.rows[0].ssl }
      );
    } catch (error: any) {
      this.addResult('Connection', 'SSL Encryption', false, `Failed to check SSL: ${error.message}`, error);
    }
  }

  async validateSchema(): Promise<void> {
    console.log('\n=== Validating Database Schema ===');

    const requiredTables = [
      'users',
      'accounts',
      'sessions',
      'verification_tokens',
      'secrets',
      'check_ins',
      'recipients',
      'admin_notifications',
    ];

    for (const table of requiredTables) {
      try {
        const result = await this.pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
          )
        `, [table]);

        const exists = result.rows[0].exists;
        this.addResult(
          'Schema',
          `Table: ${table}`,
          exists,
          exists ? `Table ${table} exists` : `ERROR: Table ${table} missing`
        );
      } catch (error: any) {
        this.addResult('Schema', `Table: ${table}`, false, `Error checking table: ${error.message}`, error);
      }
    }

    try {
      const result = await this.pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY indexname
      `);
      this.addResult('Schema', 'Indexes', true, `Found ${result.rows.length} indexes`, {
        count: result.rows.length,
        indexes: result.rows.map(r => r.indexname),
      });
    } catch (error: any) {
      this.addResult('Schema', 'Indexes', false, `Error checking indexes: ${error.message}`, error);
    }

    try {
      const result = await this.pool.query(`
        SELECT conname, contype
        FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace
      `);
      const fkCount = result.rows.filter(r => r.contype === 'f').length;
      this.addResult('Schema', 'Foreign Keys', true, `Found ${fkCount} foreign key constraints`, {
        total: result.rows.length,
        foreignKeys: fkCount,
      });
    } catch (error: any) {
      this.addResult('Schema', 'Foreign Keys', false, `Error checking constraints: ${error.message}`, error);
    }
  }

  async validateAuthorization(): Promise<void> {
    console.log('\n=== Validating Authorization Configuration ===');

    try {
      const result = await this.pool.query(`
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
      `);

      const rlsEnabled = result.rows.some(r => r.rowsecurity);
      this.addResult(
        'Authorization',
        'Row Level Security',
        !rlsEnabled,
        rlsEnabled
          ? 'WARNING: RLS is enabled (should use application-level auth)'
          : 'Correct: Using application-level authorization',
        { tables: result.rows }
      );
    } catch (error: any) {
      this.addResult('Authorization', 'Row Level Security', false, `Error checking RLS: ${error.message}`, error);
    }

    try {
      const user = process.env.CLOUD_SQL_USER || 'postgres';
      const result = await this.pool.query(`
        SELECT DISTINCT privilege_type
        FROM information_schema.table_privileges
        WHERE table_schema = 'public'
        AND grantee = $1
      `, [user]);

      const privileges = result.rows.map(r => r.privilege_type);
      const hasRequired = ['SELECT', 'INSERT', 'UPDATE'].every(p => privileges.includes(p));

      this.addResult(
        'Authorization',
        'User Permissions',
        hasRequired,
        hasRequired ? 'User has required permissions' : 'WARNING: Missing required permissions',
        { user, privileges }
      );
    } catch (error: any) {
      this.addResult('Authorization', 'User Permissions', false, `Error checking permissions: ${error.message}`, error);
    }
  }

  async validateMigrations(): Promise<void> {
    console.log('\n=== Validating Migration History ===');

    try {
      const result = await this.pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'drizzle'
          AND table_name = '__drizzle_migrations'
        )
      `);

      const exists = result.rows[0].exists;
      this.addResult(
        'Migrations',
        'Migration Tracking',
        exists,
        exists ? 'Migration tracking table exists' : 'ERROR: Migration tracking table missing'
      );

      if (exists) {
        const migrations = await this.pool.query(`
          SELECT COUNT(*) as count, MAX(created_at) as last_migration
          FROM drizzle.__drizzle_migrations
        `);
        this.addResult(
          'Migrations',
          'Applied Migrations',
          true,
          `${migrations.rows[0].count} migrations applied`,
          {
            count: migrations.rows[0].count,
            lastMigration: migrations.rows[0].last_migration,
          }
        );
      }
    } catch (error: any) {
      this.addResult('Migrations', 'Migration History', false, `Error checking migrations: ${error.message}`, error);
    }
  }

  async validateEnvironment(): Promise<void> {
    console.log('\n=== Validating Environment Configuration ===');

    const requiredEnvVars = [
      'DATABASE_URL',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL',
    ];

    requiredEnvVars.forEach(envVar => {
      const exists = !!process.env[envVar];
      this.addResult(
        'Environment',
        `Variable: ${envVar}`,
        exists,
        exists ? `${envVar} is set` : `ERROR: ${envVar} is missing`
      );
    });

    if (process.env.DATABASE_URL) {
      const hasSSL = process.env.DATABASE_URL.includes('sslmode=');
      this.addResult(
        'Environment',
        'SSL Configuration',
        hasSSL || process.env.NODE_ENV !== 'production',
        hasSSL ? 'SSL mode configured in connection string' : 'WARNING: SSL mode not in connection string'
      );
    }
  }

  async validatePerformance(): Promise<void> {
    console.log('\n=== Validating Database Performance ===');

    try {
      const start = Date.now();
      await this.pool.query('SELECT COUNT(*) FROM users');
      const duration = Date.now() - start;

      this.addResult(
        'Performance',
        'Query Speed',
        duration < 100,
        `User count query took ${duration}ms`,
        { duration }
      );
    } catch (error: any) {
      this.addResult('Performance', 'Query Speed', false, `Error testing performance: ${error.message}`, error);
    }

    try {
      const result = await this.pool.query('SHOW max_connections');
      const maxConn = parseInt(result.rows[0].max_connections);
      this.addResult(
        'Performance',
        'Connection Pool',
        maxConn > 0,
        `Max connections: ${maxConn}`,
        { maxConnections: maxConn }
      );
    } catch (error: any) {
      this.addResult('Performance', 'Connection Pool', false, `Error checking pool: ${error.message}`, error);
    }
  }

  async validateSecurity(): Promise<void> {
    console.log('\n=== Validating Security Configuration ===');

    try {
      const result = await this.pool.query("SHOW password_encryption");
      const encryption = result.rows[0].password_encryption;
      const isSecure = encryption === 'scram-sha-256';

      this.addResult(
        'Security',
        'Password Encryption',
        isSecure,
        isSecure ? 'Using SCRAM-SHA-256 encryption' : `WARNING: Using ${encryption}`,
        { encryption }
      );
    } catch (error: any) {
      this.addResult('Security', 'Password Encryption', false, `Error checking encryption: ${error.message}`, error);
    }

    try {
      const result = await this.pool.query("SHOW ssl");
      const sslEnabled = result.rows[0].ssl === 'on';
      this.addResult(
        'Security',
        'SSL Requirement',
        sslEnabled || process.env.NODE_ENV !== 'production',
        sslEnabled ? 'SSL is enabled' : 'WARNING: SSL is not enabled',
        { ssl: result.rows[0].ssl }
      );
    } catch (error: any) {
      this.addResult('Security', 'SSL Requirement', false, `Error checking SSL: ${error.message}`, error);
    }
  }

  async validateMonitoring(): Promise<void> {
    console.log('\n=== Validating Monitoring Configuration ===');

    try {
      const result = await this.pool.query("SHOW log_statement");
      this.addResult(
        'Monitoring',
        'Query Logging',
        true,
        `Log statement setting: ${result.rows[0].log_statement}`,
        { logStatement: result.rows[0].log_statement }
      );
    } catch (error: any) {
      this.addResult('Monitoring', 'Query Logging', false, `Error checking logging: ${error.message}`, error);
    }

    try {
      const result = await this.pool.query("SHOW log_connections");
      this.addResult(
        'Monitoring',
        'Connection Logging',
        true,
        `Connection logging: ${result.rows[0].log_connections}`,
        { logConnections: result.rows[0].log_connections }
      );
    } catch (error: any) {
      this.addResult('Monitoring', 'Connection Logging', false, `Error checking logging: ${error.message}`, error);
    }
  }

  private printResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('MIGRATION VALIDATION RESULTS');
    console.log('='.repeat(80));

    const categories = [...new Set(this.results.map(r => r.category))];

    categories.forEach(category => {
      console.log(`\n${category}:`);
      const categoryResults = this.results.filter(r => r.category === category);

      categoryResults.forEach(result => {
        const icon = result.passed ? '✅' : '❌';
        console.log(`  ${icon} ${result.test}: ${result.message}`);
      });
    });

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log('\n' + '='.repeat(80));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log('='.repeat(80));

    if (failedTests > 0) {
      console.log('\n⚠️  MIGRATION VALIDATION FAILED');
      console.log('Please review the failed tests and consult MIGRATION_TROUBLESHOOTING.md');
      process.exit(1);
    } else {
      console.log('\n✅ MIGRATION VALIDATION SUCCESSFUL');
      console.log('All Cloud SQL components are working correctly!');
    }
  }

  async run(): Promise<void> {
    console.log('Starting Cloud SQL Migration Validation...\n');

    await this.validateConnection();
    await this.validateSchema();
    await this.validateAuthorization();
    await this.validateMigrations();
    await this.validateEnvironment();
    await this.validatePerformance();
    await this.validateSecurity();
    await this.validateMonitoring();

    this.printResults();

    await this.pool.end();
  }
}

// Run validation
const validator = new MigrationValidator();
validator.run().catch(error => {
  console.error('Fatal error during validation:', error);
  process.exit(1);
});
