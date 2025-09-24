#!/usr/bin/env tsx

/**
 * Database connection test script
 * Tests the Cloud SQL connection and verifies database setup
 */

import { config } from "dotenv";
config();

import { checkDatabaseConnection, closeDatabaseConnection } from "../src/lib/db/connection";
import { testDatabaseConnection } from "../src/lib/db/operations";

async function testConnection() {
  console.log("🔍 Testing Cloud SQL connection...");

  try {
    // Test basic connection
    console.log("1. Testing basic database connection...");
    const basicConnection = await checkDatabaseConnection();

    if (basicConnection) {
      console.log("✅ Basic connection successful");
    } else {
      console.log("❌ Basic connection failed");
      return;
    }

    // Test Drizzle operations
    console.log("2. Testing Drizzle ORM operations...");
    const drizzleTest = await testDatabaseConnection();

    if (drizzleTest) {
      console.log("✅ Drizzle ORM connection successful");
    } else {
      console.log("❌ Drizzle ORM connection failed");
      return;
    }

    console.log("\n🎉 All database tests passed!");
    console.log("✅ Cloud SQL is ready for use");

  } catch (error) {
    console.error("❌ Database test failed:", error);

    if (error instanceof Error) {
      if (error.message.includes("ENOTFOUND") || error.message.includes("ECONNREFUSED")) {
        console.log("\n💡 Connection troubleshooting:");
        console.log("1. Ensure Cloud SQL instance is running");
        console.log("2. Check authorized networks configuration");
        console.log("3. Verify DATABASE_URL environment variable");
        console.log("4. Consider using Cloud SQL Proxy for local development");
      }
    }
  } finally {
    // Clean up connection
    await closeDatabaseConnection();
  }
}

// Run the test
testConnection().catch(console.error);