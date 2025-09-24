#!/usr/bin/env node

/**
 * Database Migration Script
 * Applies the consolidated schema migration to local Postgres
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigrations() {
  console.log('🗄️ Starting database migration...');

  // Database connection configuration
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'keyfate_dev',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'dev_password_change_in_prod',
  });

  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Read the local-compatible migration
    const migrationPath = path.join(__dirname, '../database/migrations/20241231_local_schema.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Read migration file');

    // Apply migration
    console.log('⚡ Applying migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration applied successfully');

    // Verify migration
    const result = await client.query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);

    console.log(`✅ Migration verification: ${result.rows[0].table_count} tables created`);

    client.release();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }

  console.log('🎉 Database migration completed successfully!');
}

// Run if called directly
if (require.main === module) {
  runMigrations().catch(console.error);
}

module.exports = { runMigrations };