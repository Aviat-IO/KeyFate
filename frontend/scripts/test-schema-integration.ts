#!/usr/bin/env tsx
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/db/drizzle";
import { secrets } from "../src/lib/db/schema";

async function testSchemaIntegration() {
  console.log("🧪 Running Schema Integration Tests (TDD Validation)...");

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
  }

  let testPassed = 0;
  let testFailed = 0;

  // Test 1: Verify recipient_name column exists
  try {
    console.log("\n1. Testing recipient_name column exists...");
    const result = await db.execute(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'secrets'
      AND column_name = 'recipient_name';
    `);

    if (result.rows.length === 1) {
      const column = result.rows[0];
      if (column.column_name === 'recipient_name' &&
          column.data_type === 'text' &&
          column.is_nullable === 'NO') {
        console.log("   ✅ recipient_name column exists with correct type and constraints");
        testPassed++;
      } else {
        console.log("   ❌ recipient_name column has incorrect properties:", column);
        testFailed++;
      }
    } else {
      console.log("   ❌ recipient_name column does not exist");
      testFailed++;
    }
  } catch (error) {
    console.log("   ❌ Error checking recipient_name column:", error.message);
    testFailed++;
  }

  // Test 2: Verify all required columns exist
  try {
    console.log("\n2. Testing all required columns exist...");
    const result = await db.execute(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'secrets'
      ORDER BY ordinal_position;
    `);

    const columns = result.rows.map(row => row.column_name);
    const requiredColumns = [
      'id', 'user_id', 'title', 'recipient_name', 'recipient_email',
      'recipient_phone', 'contact_method', 'check_in_days', 'status',
      'server_share', 'iv', 'auth_tag', 'sss_shares_total', 'sss_threshold',
       'last_check_in', 'next_check_in', 'triggered_at',
      'created_at', 'updated_at'
    ];

    const missingColumns = requiredColumns.filter(col => !columns.includes(col));

    if (missingColumns.length === 0) {
      console.log("   ✅ All required columns present");
      testPassed++;
    } else {
      console.log("   ❌ Missing columns:", missingColumns);
      testFailed++;
    }
  } catch (error) {
    console.log("   ❌ Error checking required columns:", error.message);
    testFailed++;
  }

  // Test 3: Verify Drizzle schema matches database
  try {
    console.log("\n3. Testing Drizzle schema compatibility...");
    const result = await db
      .select({
        id: secrets.id,
        recipientName: secrets.recipientName,
        title: secrets.title
      })
      .from(secrets)
      .limit(1);

    console.log("   ✅ Drizzle can query secrets table without errors");
    testPassed++;
  } catch (error) {
    console.log("   ❌ Drizzle schema mismatch:", error.message);
    testFailed++;
  }

  // Test 4: Test secret creation (insert and delete)
  try {
    console.log("\n4. Testing secret creation functionality...");
    const testSecret = {
      userId: 'test-user-schema-validation',
      title: 'Schema Test Secret',
      recipientName: 'Test Recipient Schema',
      recipientEmail: 'test-schema@example.com',
      contactMethod: 'email' as const,
      checkInDays: 30,
      status: 'active' as const,
      nextCheckIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sssSharesTotal: 3,
      sssThreshold: 2
    };

    const result = await db.insert(secrets).values(testSecret).returning();

    if (result.length === 1 && result[0].recipientName === 'Test Recipient Schema') {
      console.log("   ✅ Secret creation successful");

      // Clean up test data
      if (result[0].id) {
        await db.delete(secrets).where(db.sql`id = ${result[0].id}`);
        console.log("   ✅ Test data cleaned up");
      }
      testPassed++;
    } else {
      console.log("   ❌ Secret creation failed or returned unexpected data");
      testFailed++;
    }
  } catch (error) {
    console.log("   ❌ Error testing secret creation:", error.message);
    testFailed++;
  }

  // Test 5: Test RobustSecretsService would now work
  try {
    console.log("\n5. Testing RobustSecretsService compatibility...");
    const { RobustSecretsService } = await import("../src/lib/db/secrets-service-robust");
    const robustService = new RobustSecretsService(process.env.DATABASE_URL!);

    const testSecret = {
      userId: 'test-user-robust-validation',
      title: 'Robust Service Test',
      recipientName: 'Robust Test Recipient',
      recipientEmail: 'robust-test@example.com',
      contactMethod: 'email' as const,
      checkInDays: 30,
      status: 'active' as const,
      nextCheckIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sssSharesTotal: 3,
      sssThreshold: 2
    };

    const result = await robustService.create(testSecret);

    if (result && result.recipientName === 'Robust Test Recipient') {
      console.log("   ✅ RobustSecretsService creation successful");

      // Clean up
      if (result.id) {
        await robustService.delete(result.id);
        console.log("   ✅ Robust service test data cleaned up");
      }
      testPassed++;
    } else {
      console.log("   ❌ RobustSecretsService failed");
      testFailed++;
    }
  } catch (error) {
    console.log("   ❌ Error testing RobustSecretsService:", error.message);
    testFailed++;
  }

  // Summary
  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${testPassed}`);
  console.log(`   ❌ Failed: ${testFailed}`);
  console.log(`   📈 Success Rate: ${Math.round((testPassed / (testPassed + testFailed)) * 100)}%`);

  if (testFailed === 0) {
    console.log("\n🎉 All schema integration tests passed!");
    console.log("✅ Database schema is correctly migrated and functional");
    console.log("✅ recipient_name column issue has been resolved");
    process.exit(0);
  } else {
    console.log("\n❌ Some tests failed - schema issues may still exist");
    process.exit(1);
  }
}

testSchemaIntegration().catch(error => {
  console.error("❌ Schema integration test failed:", error);
  process.exit(1);
});