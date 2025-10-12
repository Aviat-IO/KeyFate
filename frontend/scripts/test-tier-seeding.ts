#!/usr/bin/env tsx

/**
 * Test script to verify tier seeding works correctly
 * Run with: npx tsx scripts/test-tier-seeding.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dotenv from "dotenv";
import { subscriptionTiers } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

dotenv.config({ path: ".env.local" });

async function testTierSeeding() {
  console.log("🧪 Testing tier seeding...\n");

  const connectionString = process.env.DATABASE_URL || 
    "postgresql://postgres:dev_password_change_in_prod@localhost:5432/keyfate_dev";

  const queryClient = postgres(connectionString, { max: 1 });
  const db = drizzle(queryClient);

  try {
    // Check if tiers exist
    console.log("📊 Checking existing tiers...");
    const allTiers = await db.select().from(subscriptionTiers);
    
    console.log(`Found ${allTiers.length} tiers in database:`);
    allTiers.forEach(tier => {
      console.log(`  - ${tier.name}: ${tier.displayName}`);
      console.log(`    Max Secrets: ${tier.maxSecrets}`);
      console.log(`    Max Recipients: ${tier.maxRecipientsPerSecret}`);
      console.log(`    Custom Intervals: ${tier.customIntervals}`);
      console.log(`    Price Monthly: ${tier.priceMonthly || 'N/A'}`);
      console.log(`    Price Yearly: ${tier.priceYearly || 'N/A'}`);
      console.log();
    });

    // Verify free tier
    const [freeTier] = await db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.name, "free"))
      .limit(1);

    if (!freeTier) {
      console.error("❌ Free tier not found!");
      process.exit(1);
    }

    console.log("✅ Free tier exists");

    // Verify pro tier
    const [proTier] = await db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.name, "pro"))
      .limit(1);

    if (!proTier) {
      console.error("❌ Pro tier not found!");
      process.exit(1);
    }

    console.log("✅ Pro tier exists");

    // Verify tier properties
    const checks = [
      { name: "Free tier max secrets", value: freeTier.maxSecrets, expected: 1 },
      { name: "Free tier max recipients", value: freeTier.maxRecipientsPerSecret, expected: 1 },
      { name: "Free tier custom intervals", value: freeTier.customIntervals, expected: false },
      { name: "Pro tier max secrets", value: proTier.maxSecrets, expected: 10 },
      { name: "Pro tier max recipients", value: proTier.maxRecipientsPerSecret, expected: 5 },
      { name: "Pro tier custom intervals", value: proTier.customIntervals, expected: true },
    ];

    let allPassed = true;
    checks.forEach(check => {
      const passed = check.value === check.expected;
      if (passed) {
        console.log(`✅ ${check.name}: ${check.value}`);
      } else {
        console.error(`❌ ${check.name}: expected ${check.expected}, got ${check.value}`);
        allPassed = false;
      }
    });

    if (allPassed) {
      console.log("\n🎉 All tier seeding tests passed!");
    } else {
      console.error("\n❌ Some tier seeding tests failed!");
      process.exit(1);
    }

  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

testTierSeeding();
