#!/usr/bin/env tsx
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(__dirname, "../.env.local") });

async function validateSchemaFix() {
  console.log("🔍 Final Schema Fix Validation - TDD REFACTOR Phase");
  console.log("================================================");

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
  }

  let allTestsPassed = true;
  const testResults = [];

  // Test 1: Direct database verification
  console.log("\n1. 🧪 Testing direct database schema...");
  try {
    const postgres = (await import("postgres")).default;
    const client = postgres(process.env.DATABASE_URL);

    const result = await client`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'secrets'
      AND column_name = 'recipient_name'
    `;

    if (result.length === 1 && result[0].column_name === 'recipient_name') {
      console.log("   ✅ recipient_name column exists in database");
      testResults.push("✅ Database Schema: recipient_name column present");
    } else {
      console.log("   ❌ recipient_name column missing from database");
      testResults.push("❌ Database Schema: recipient_name column missing");
      allTestsPassed = false;
    }

    await client.end();
  } catch (error) {
    console.log("   ❌ Database test failed:", error.message);
    testResults.push("❌ Database Schema: Test failed");
    allTestsPassed = false;
  }

  // Test 2: Drizzle ORM compatibility
  console.log("\n2. 🧪 Testing Drizzle ORM schema compatibility...");
  try {
    const { db } = await import("../src/lib/db/drizzle");
    const { secrets } = await import("../src/lib/db/schema");

    const result = await db
      .select({
        id: secrets.id,
        recipientName: secrets.recipientName,
      })
      .from(secrets)
      .limit(1);

    console.log("   ✅ Drizzle ORM can query secrets table successfully");
    testResults.push("✅ Drizzle ORM: Schema compatibility verified");
  } catch (error) {
    console.log("   ❌ Drizzle ORM test failed:", error.message);
    testResults.push("❌ Drizzle ORM: Schema mismatch detected");
    allTestsPassed = false;
  }

  // Test 3: Standard secrets service
  console.log("\n3. 🧪 Testing standard secretsService...");
  try {
    const { secretsService } = await import("../src/lib/db/drizzle");

    const testSecret = {
      userId: 'validation-test-user',
      title: 'Validation Test Secret',
      recipientName: 'Test Validation Recipient',
      recipientEmail: 'validation@example.com',
      contactMethod: 'email' as const,
      checkInDays: 30,
      status: 'active' as const,
      nextCheckIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sssSharesTotal: 3,
      sssThreshold: 2
    };

    const result = await secretsService.create(testSecret);

    if (result && result.id && result.recipientName === 'Test Validation Recipient') {
      console.log("   ✅ Standard secretsService working correctly");
      testResults.push("✅ Standard Service: Secret creation successful");

      // Clean up
      await secretsService.delete(result.id);
      console.log("   ✅ Test data cleaned up");
    } else {
      console.log("   ❌ Standard secretsService failed");
      testResults.push("❌ Standard Service: Secret creation failed");
      allTestsPassed = false;
    }
  } catch (error) {
    console.log("   ❌ Standard service test failed:", error.message);
    if (error.message.includes('recipient_name')) {
      testResults.push("❌ Standard Service: recipient_name column error");
    } else {
      testResults.push("❌ Standard Service: Other error");
    }
    allTestsPassed = false;
  }

  // Test 4: RobustSecretsService (fallback)
  console.log("\n4. 🧪 Testing RobustSecretsService...");
  try {
    const { RobustSecretsService } = await import("../src/lib/db/secrets-service-robust");
    const robustService = new RobustSecretsService(process.env.DATABASE_URL);

    const testSecret = {
      userId: 'robust-validation-test-user',
      title: 'Robust Validation Test Secret',
      recipientName: 'Robust Test Recipient',
      recipientEmail: 'robust-validation@example.com',
      contactMethod: 'email' as const,
      checkInDays: 30,
      status: 'active' as const,
      nextCheckIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sssSharesTotal: 3,
      sssThreshold: 2
    };

    const result = await robustService.create(testSecret);

    if (result && result.id && result.recipientName === 'Robust Test Recipient') {
      console.log("   ✅ RobustSecretsService working correctly");
      testResults.push("✅ Robust Service: Fallback service functional");

      // Clean up
      await robustService.delete(result.id);
      console.log("   ✅ Test data cleaned up");
    } else {
      console.log("   ❌ RobustSecretsService failed");
      testResults.push("❌ Robust Service: Fallback service failed");
      allTestsPassed = false;
    }
  } catch (error) {
    console.log("   ❌ Robust service test failed:", error.message);
    testResults.push("❌ Robust Service: Test failed");
    allTestsPassed = false;
  }

  // Test 5: API route readiness (import test)
  console.log("\n5. 🧪 Testing API route import readiness...");
  try {
    // Test that the API route can be imported without errors
    const apiModule = await import("../src/app/api/secrets/route");

    if (apiModule && typeof apiModule.POST === 'function') {
      console.log("   ✅ API route imports successfully");
      testResults.push("✅ API Route: Import successful");
    } else {
      console.log("   ❌ API route import failed");
      testResults.push("❌ API Route: Import failed");
      allTestsPassed = false;
    }
  } catch (error) {
    console.log("   ❌ API route import test failed:", error.message);
    testResults.push("❌ API Route: Import error");
    allTestsPassed = false;
  }

  // Final Results
  console.log("\n" + "=".repeat(50));
  console.log("📊 FINAL VALIDATION RESULTS");
  console.log("=".repeat(50));

  testResults.forEach(result => console.log(result));

  if (allTestsPassed) {
    console.log("\n🎉 SUCCESS! All validation tests passed!");
    console.log("✅ Database schema migration completed successfully");
    console.log("✅ recipient_name column issue has been resolved");
    console.log("✅ RobustSecretsService TypeError should be fixed");
    console.log("✅ API routes should now work without database errors");

    console.log("\n📋 What was fixed:");
    console.log("   • Added missing recipient_name column to secrets table");
    console.log("   • Applied complete schema migration from old Supabase format");
    console.log("   • Verified Drizzle ORM compatibility");
    console.log("   • Tested both standard and robust services");
    console.log("   • Ensured API routes can import without errors");

    console.log("\n🔧 Tools available for future use:");
    console.log("   • npm run db:simple-test - Quick database connectivity test");
    console.log("   • npm run db:test-schema - Comprehensive schema validation");
    console.log("   • npm run db:migrate-to-current - Full schema migration");
    console.log("   • npm run db:fix-schema - Column-specific fixes");

    process.exit(0);
  } else {
    console.log("\n❌ VALIDATION FAILED!");
    console.log("Some tests failed - there may still be schema issues");
    console.log("Review the failed tests above and run individual scripts to debug");
    process.exit(1);
  }
}

validateSchemaFix();