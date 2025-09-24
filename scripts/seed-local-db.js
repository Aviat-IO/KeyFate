#!/usr/bin/env node

/**
 * Local Database Seeding Script
 * Seeds the local database with development data
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  // Load environment variables
  require('dotenv').config({ path: '.env.local' });

  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'keyfate_dev',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'dev_password_change_in_prod',
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    console.log('📄 Creating development seed data...');

    // Create development data using UUIDs and proper references
    await client.query(`
      -- Get tier IDs (they should exist from migration)
      SELECT id FROM tiers WHERE name = 'free';
      SELECT id FROM tiers WHERE name = 'pro';
    `);

    // Get the actual tier IDs
    const freeTier = await client.query(`SELECT id FROM tiers WHERE name = 'free' LIMIT 1`);
    const proTier = await client.query(`SELECT id FROM tiers WHERE name = 'pro' LIMIT 1`);

    if (freeTier.rows.length === 0 || proTier.rows.length === 0) {
      throw new Error('Tiers not found. Make sure migration was run first.');
    }

    const freeTierId = freeTier.rows[0].id;
    const proTierId = proTier.rows[0].id;

    // Create development users
    await client.query(`
      INSERT INTO auth_users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) VALUES
      ('11111111-1111-1111-1111-111111111111', 'dev@localhost', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW()),
      ('22222222-2222-2222-2222-222222222222', 'test@localhost', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    // Assign user tiers
    await client.query(`
      INSERT INTO user_tiers (user_id, tier_id) VALUES
      ('11111111-1111-1111-1111-111111111111', $1),
      ('22222222-2222-2222-2222-222222222222', $2)
      ON CONFLICT (user_id, tier_id) DO NOTHING;
    `, [freeTierId, proTierId]);

    // Create development secrets
    await client.query(`
      INSERT INTO secrets (id, user_id, title, content, status, created_at, updated_at) VALUES
      ('aaaaaaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Development Secret 1', 'This is a test secret for development', 'active', NOW(), NOW()),
      ('bbbbbbbb-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Development Secret 2', 'Another test secret', 'active', NOW(), NOW()),
      ('cccccccc-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Pro User Secret 3', 'Pro users can have multiple secrets', 'active', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    // Verify seeding
    const userCount = await client.query('SELECT COUNT(*) as count FROM auth_users');
    const secretCount = await client.query('SELECT COUNT(*) as count FROM secrets');
    const tierCount = await client.query('SELECT COUNT(*) as count FROM tiers');

    console.log('✅ Seeding completed successfully:');
    console.log(`   👥 Users: ${userCount.rows[0].count}`);
    console.log(`   🔐 Secrets: ${secretCount.rows[0].count}`);
    console.log(`   📊 Tiers: ${tierCount.rows[0].count}`);

    client.release();
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }

  console.log('🎉 Database seeding completed!');
  console.log('');
  console.log('🔑 Development Login Credentials:');
  console.log('   📧 dev@localhost / password123 (Free tier)');
  console.log('   📧 test@localhost / password123 (Pro tier)');
}

// Run if called directly
if (require.main === module) {
  seedDatabase().catch(console.error);
}

module.exports = { seedDatabase };