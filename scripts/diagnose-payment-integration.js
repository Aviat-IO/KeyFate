#!/usr/bin/env node

const { Pool } = require("pg")

require("dotenv").config({ path: ".env.local" })

async function diagnosePaymentIntegration() {
  console.log("🔍 Diagnosing Payment Integration\n")

  const config = {
    host: process.env.POSTGRES_HOST || "localhost",
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || "keyfate_dev",
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "dev_password_change_in_prod",
  }

  const pool = new Pool(config)

  try {
    const client = await pool.connect()

    console.log("1️⃣  Checking database connectivity...")
    await client.query("SELECT 1")
    console.log("✅ Database connected\n")

    console.log("2️⃣  Checking subscription_tiers table...")
    const tiersResult = await client.query("SELECT * FROM subscription_tiers")
    console.log(`   Found ${tiersResult.rows.length} tiers:`)
    tiersResult.rows.forEach((tier) => {
      console.log(
        `   - ${tier.name} (${tier.display_name}): ${tier.max_secrets} secrets, ${tier.max_recipients_per_secret} recipients`,
      )
    })

    if (tiersResult.rows.length === 0) {
      console.log(
        "   ⚠️  WARNING: No tiers found! Need to seed subscription tiers.",
      )
    }
    console.log("")

    console.log("3️⃣  Checking user_subscriptions table...")
    const subscriptionsResult = await client.query(
      "SELECT * FROM user_subscriptions",
    )
    console.log(`   Found ${subscriptionsResult.rows.length} subscriptions`)

    if (subscriptionsResult.rows.length > 0) {
      console.log("   Subscriptions:")
      subscriptionsResult.rows.forEach((sub) => {
        console.log(
          `   - User: ${sub.user_id}, Status: ${sub.status}, Provider: ${sub.provider}`,
        )
      })
    } else {
      console.log(
        "   ⚠️  No subscriptions found - this matches the reported issue",
      )
    }
    console.log("")

    console.log("4️⃣  Checking payment_history table...")
    const paymentsResult = await client.query("SELECT * FROM payment_history")
    console.log(`   Found ${paymentsResult.rows.length} payments`)

    if (paymentsResult.rows.length > 0) {
      console.log("   Payments:")
      paymentsResult.rows.forEach((payment) => {
        console.log(
          `   - User: ${payment.user_id}, Amount: ${payment.amount} ${payment.currency}, Status: ${payment.status}`,
        )
      })
    } else {
      console.log(
        "   ⚠️  No payment history found - this matches the reported issue",
      )
    }
    console.log("")

    console.log("5️⃣  Checking users table...")
    const usersResult = await client.query(
      "SELECT id, email FROM users LIMIT 3",
    )
    console.log(`   Found users in database (showing first 3):`)
    if (usersResult.rows.length > 0) {
      usersResult.rows.forEach((user) => {
        console.log(`   - ${user.email} (${user.id})`)
      })
    }
    console.log("")

    console.log("6️⃣  Environment variable check:")
    console.log(
      `   STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? "✅ Set (sk_***)" : "❌ Missing or empty"}`,
    )
    console.log(
      `   STRIPE_WEBHOOK_SECRET: ${process.env.STRIPE_WEBHOOK_SECRET ? "✅ Set (whsec_***)" : "❌ Missing or empty"}`,
    )
    console.log(
      `   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? "✅ Set" : "❌ Missing or empty"}`,
    )
    console.log("")

    console.log("📋 DIAGNOSIS SUMMARY:")
    console.log("─────────────────────────────────────────────")

    const issues = []

    if (tiersResult.rows.length === 0) {
      issues.push("❌ No subscription tiers in database - run seed script")
    }

    if (subscriptionsResult.rows.length === 0) {
      issues.push(
        "❌ No subscriptions found (payment webhooks not creating records)",
      )
    }

    if (paymentsResult.rows.length === 0) {
      issues.push("❌ No payment history found")
    }

    if (
      !process.env.STRIPE_WEBHOOK_SECRET ||
      process.env.STRIPE_WEBHOOK_SECRET.trim() === ""
    ) {
      issues.push("❌ STRIPE_WEBHOOK_SECRET not configured in .env.local")
    }

    if (
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.trim() === ""
    ) {
      issues.push("❌ STRIPE_SECRET_KEY not configured in .env.local")
    }

    if (issues.length > 0) {
      console.log("ISSUES FOUND:")
      issues.forEach((issue) => console.log(issue))
      console.log("\n💡 NEXT STEPS:")
      console.log("   1. Configure Stripe keys in .env.local")
      console.log("   2. Ensure subscription_tiers table is seeded")
      console.log("   3. Test a payment with Stripe test mode")
      console.log("   4. Check webhook delivery in Stripe dashboard")
    } else {
      console.log("✅ All checks passed!")
    }

    client.release()
    await pool.end()
    process.exit(issues.length > 0 ? 1 : 0)
  } catch (error) {
    console.error("❌ Error during diagnosis:", error.message)
    await pool.end()
    process.exit(1)
  }
}

diagnosePaymentIntegration()
