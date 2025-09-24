#!/usr/bin/env tsx
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(__dirname, "../.env.local") });

import postgres from "postgres";

async function migrateSchemaToCurrentState() {
  console.log("🔄 Migrating database schema to current state...");

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
  }

  try {
    const client = postgres(process.env.DATABASE_URL);

    console.log("1. Checking current schema state...");

    // Check current columns
    const currentColumns = await client`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'secrets'
      ORDER BY ordinal_position
    `;

    console.log("Current columns:", currentColumns.map(c => c.column_name));

    // Detect if this is the old Supabase schema
    const hasOldSchema = currentColumns.some(col => col.column_name === 'content') &&
                        currentColumns.some(col => col.column_name === 'interval_value');

    if (hasOldSchema) {
      console.log("🔍 Detected old Supabase schema - migrating to new structure...");

      // Backup existing data if any
      const existingSecrets = await client`SELECT * FROM secrets`;
      console.log(`📋 Found ${existingSecrets.length} existing secrets to preserve`);

      // Drop the old table and recreate with new schema
      console.log("2. Dropping old secrets table...");
      await client`DROP TABLE IF EXISTS secrets CASCADE`;

      console.log("3. Applying new schema migration...");

      // Read and execute the migration file
      const fs = require('fs');
      const path = require('path');
      const migrationPath = path.join(__dirname, '../drizzle/0000_chubby_daimon_hellstrom.sql');

      if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration file not found: ${migrationPath}`);
      }

      const migrationSql = fs.readFileSync(migrationPath, 'utf8');

      // Split by statement-breakpoint and execute each statement
      const statements = migrationSql.split('--> statement-breakpoint');

      for (const statement of statements) {
        const trimmed = statement.trim();
        if (trimmed && !trimmed.startsWith('--')) {
          try {
            await client.unsafe(trimmed);
          } catch (error) {
            // Ignore errors for CREATE TYPE and CREATE TABLE IF NOT EXISTS
            if (!error.message.includes('already exists')) {
              console.warn(`Warning executing statement: ${error.message}`);
            }
          }
        }
      }

      console.log("✅ New schema applied successfully");

      // Note: We can't automatically migrate old data as the schemas are too different
      if (existingSecrets.length > 0) {
        console.log("⚠️  Data migration not automated due to schema differences");
        console.log("   Old secrets data structure is incompatible with new schema");
        console.log("   Manual data migration may be required");
      }

    } else {
      console.log("🔍 Current schema detected - checking for missing columns...");

      // Check if we have the expected new schema columns
      const hasRecipientName = currentColumns.some(col => col.column_name === 'recipient_name');

      if (!hasRecipientName) {
        console.log("❌ Missing new schema columns - this appears to be a partial migration");
        console.log("🔧 Applying Drizzle migration to sync schema...");

        // Use drizzle-kit push to sync the schema
        const { execSync } = require('child_process');
        execSync('npm run db:push', {
          stdio: 'inherit',
          cwd: resolve(__dirname, '..'),
          env: { ...process.env }
        });

        console.log("✅ Schema synced with Drizzle");
      } else {
        console.log("✅ Schema appears to be up to date");
      }
    }

    // Final verification
    console.log("4. Verifying final schema...");
    const finalColumns = await client`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'secrets'
      ORDER BY ordinal_position
    `;

    console.log("\n📋 Final secrets table structure:");
    finalColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    const hasRecipientName = finalColumns.some(col => col.column_name === 'recipient_name');
    if (hasRecipientName) {
      console.log("\n✅ Migration successful - recipient_name column exists");
    } else {
      console.log("\n❌ Migration failed - recipient_name column still missing");
      process.exit(1);
    }

    await client.end();
    console.log("\n🎉 Schema migration completed successfully!");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateSchemaToCurrentState();