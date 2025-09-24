#!/usr/bin/env node

/**
 * Database Connection Test Script
 * Validates database connectivity and configuration
 */

const { Pool } = require('pg');

async function testConnection() {
  console.log('🔌 Testing database connection...');

  // Load environment variables
  require('dotenv').config({ path: '.env.local' });

  const config = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'keyfate_dev',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'dev_password_change_in_prod',
  };

  console.log('📋 Connection Configuration:');
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   User: ${config.user}`);
  console.log('');

  const pool = new Pool(config);

  try {
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');

    // Test database version
    const versionResult = await client.query('SELECT version()');
    console.log(`✅ PostgreSQL Version: ${versionResult.rows[0].version.split(' ')[1]}`);

    // Test database name
    const dbResult = await client.query('SELECT current_database()');
    console.log(`✅ Connected to database: ${dbResult.rows[0].current_database}`);

    // Test extensions
    const extensionsResult = await client.query(`
      SELECT extname FROM pg_extension
      WHERE extname IN ('uuid-ossp', 'pgcrypto')
      ORDER BY extname
    `);

    const extensions = extensionsResult.rows.map(row => row.extname);
    console.log(`✅ Required extensions installed: ${extensions.join(', ')}`);

    // Test table count
    const tablesResult = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);
    console.log(`✅ Tables in public schema: ${tablesResult.rows[0].count}`);

    // Test write access
    await client.query(`
      CREATE TABLE IF NOT EXISTS connection_test (
        id SERIAL PRIMARY KEY,
        test_time TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query('INSERT INTO connection_test DEFAULT VALUES');
    const testResult = await client.query('SELECT COUNT(*) as count FROM connection_test');
    await client.query('DROP TABLE connection_test');

    console.log(`✅ Write access confirmed (${testResult.rows[0].count} test records)`);

    client.release();
    console.log('');
    console.log('🎉 All database tests passed!');
    console.log('✅ Database is ready for development');

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting tips:');
    console.error('   1. Ensure Docker containers are running: make status');
    console.error('   2. Check environment variables in .env.local');
    console.error('   3. Verify database is ready: docker-compose logs postgres');
    console.error('   4. Try restarting services: make stop && make dev');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  testConnection().catch(console.error);
}

module.exports = { testConnection };