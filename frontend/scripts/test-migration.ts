#!/usr/bin/env tsx
/**
 * Test script to validate the consolidated database migration
 * This script checks if the migration can be applied and the schema is correct
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '../src/lib/db/schema';

async function testMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('🧪 Testing consolidated database migration...');

  try {
    // Create connection
    const migrationClient = postgres(databaseUrl, { max: 1 });
    const db = drizzle(migrationClient, { schema });

    // Run migration
    console.log('📦 Applying migration...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migration applied successfully!');

    // Test that we can query the tables
    console.log('🔍 Testing table access...');

    // Test NextAuth tables
    const userCount = await db.$count(schema.users);
    const accountCount = await db.$count(schema.accounts);
    const sessionCount = await db.$count(schema.sessions);
    const verificationTokenCount = await db.$count(schema.verificationTokens);

    // Test application tables
    const secretCount = await db.$count(schema.secrets);
    const adminNotificationCount = await db.$count(schema.adminNotifications);
    const subscriptionTierCount = await db.$count(schema.subscriptionTiers);
    const userSubscriptionCount = await db.$count(schema.userSubscriptions);

    console.log('📊 Table counts:');
    console.log(`  Users: ${userCount}`);
    console.log(`  Accounts: ${accountCount}`);
    console.log(`  Sessions: ${sessionCount}`);
    console.log(`  Verification Tokens: ${verificationTokenCount}`);
    console.log(`  Secrets: ${secretCount}`);
    console.log(`  Admin Notifications: ${adminNotificationCount}`);
    console.log(`  Subscription Tiers: ${subscriptionTierCount}`);
    console.log(`  User Subscriptions: ${userSubscriptionCount}`);

    await migrationClient.end();
    console.log('✅ All tests passed! Migration is working correctly.');

  } catch (error) {
    console.error('❌ Migration test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testMigration();
}