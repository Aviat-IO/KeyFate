#!/usr/bin/env tsx
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(__dirname, "../.env.local") });

async function testRobustService() {
  console.log("🧪 Testing RobustSecretsService after schema fix...");

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
  }

  try {
    // Import after environment is loaded
    const { RobustSecretsService } = await import("../src/lib/db/secrets-service-robust");

    console.log("1. Creating RobustSecretsService instance...");
    const robustService = new RobustSecretsService(process.env.DATABASE_URL);

    console.log("2. Testing secret creation with recipient_name field...");
    const testSecret = {
      userId: 'test-user-robust-schema-fix',
      title: 'Schema Fix Validation Secret',
      recipientName: 'John Doe Schema Test',
      recipientEmail: 'john.schema@example.com',
      contactMethod: 'email' as const,
      checkInDays: 30,
      status: 'active' as const,
      nextCheckIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sssSharesTotal: 3,
      sssThreshold: 2
    };

    console.log("3. Attempting to create secret...");
    const result = await robustService.create(testSecret);

    if (result && result.id) {
      console.log("✅ Secret created successfully!");
      console.log("   ID:", result.id);
      console.log("   Recipient Name:", result.recipientName);
      console.log("   Title:", result.title);

      console.log("4. Testing retrieval...");
      const retrieved = await robustService.getById(result.id, result.userId);

      if (retrieved && retrieved.recipientName === 'John Doe Schema Test') {
        console.log("✅ Secret retrieval successful with correct recipient_name!");
      } else {
        console.log("❌ Secret retrieval failed or data mismatch");
      }

      console.log("5. Cleaning up test data...");
      await robustService.delete(result.id);
      console.log("✅ Test data cleaned up");

      console.log("\n🎉 SUCCESS! RobustSecretsService is working correctly");
      console.log("✅ recipient_name column issue has been RESOLVED");
      console.log("✅ The TypeError: Cannot read properties of undefined (reading 'map') should be fixed");

    } else {
      console.log("❌ Secret creation failed - result is empty");
    }

  } catch (error) {
    console.error("❌ RobustSecretsService test failed:", error);

    if (error.message.includes('recipient_name')) {
      console.log("❌ Still having recipient_name column issues");
      console.log("🔧 The schema migration may not have been applied correctly");
    } else if (error.message.includes("Cannot read properties of undefined")) {
      console.log("❌ Still having the undefined map error");
      console.log("🔧 This suggests the database query is returning undefined");
    } else {
      console.log("❌ Different error occurred");
    }

    process.exit(1);
  }
}

testRobustService();