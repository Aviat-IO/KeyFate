#!/usr/bin/env tsx
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(__dirname, "../.env.local") });

import postgres from "postgres";

async function testDatabaseConnection() {
  console.log("🔍 Testing database connection...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "Not set");

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
  }

  try {
    const client = postgres(process.env.DATABASE_URL);

    // Test basic query
    const result = await client`SELECT 1 as test`;
    console.log("✅ Database connection successful");
    console.log("Test query result:", result);

    // Test if secrets table exists
    const tableCheck = await client`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'secrets'
    `;

    if (tableCheck.length > 0) {
      console.log("✅ Secrets table exists");

      // Check columns
      const columns = await client`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'secrets'
        ORDER BY ordinal_position
      `;

      console.log("\n📋 Secrets table columns:");
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });

      // Check specifically for recipient_name
      const recipientNameExists = columns.some(col => col.column_name === 'recipient_name');
      if (recipientNameExists) {
        console.log("\n✅ recipient_name column exists");
      } else {
        console.log("\n❌ recipient_name column is MISSING");
      }
    } else {
      console.log("❌ Secrets table does not exist");
    }

    await client.end();
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
}

testDatabaseConnection();