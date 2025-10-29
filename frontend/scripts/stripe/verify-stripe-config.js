#!/usr/bin/env node

const Stripe = require("stripe")
const fs = require("fs")
const path = require("path")

// Load environment variables from .env.development.local
const envPath = path.join(__dirname, "..", ".env.development.local")
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8")
  envContent.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=")
    if (key && valueParts.length > 0) {
      const value = valueParts.join("=").replace(/^["']|["']$/g, "")
      process.env[key.trim()] = value.trim()
    }
  })
}

async function verifyStripeConfig() {
  console.log("🔍 Verifying Stripe configuration...\n")

  const secretKey = process.env.STRIPE_SECRET_KEY
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

  if (!secretKey) {
    console.error("❌ STRIPE_SECRET_KEY is not set")
    return
  }

  if (!publishableKey) {
    console.error("❌ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set")
    return
  }

  console.log("✅ Environment variables found")
  const isTestSecret = secretKey.startsWith("sk_test_")
  const isLiveSecret = secretKey.startsWith("sk_live_")
  const isTestPublishable = publishableKey.startsWith("pk_test_")
  const isLivePublishable = publishableKey.startsWith("pk_live_")
  console.log(
    `Secret key: sk_${isTestSecret ? "test" : isLiveSecret ? "live" : "***"}_***`,
  )
  console.log(
    `Publishable key: pk_${isTestPublishable ? "test" : isLivePublishable ? "live" : "***"}_***`,
  )

  // Check if keys are test or live
  const isTestSecret = secretKey.startsWith("sk_test_")
  const isTestPublishable = publishableKey.startsWith("pk_test_")
  const isLiveSecret = secretKey.startsWith("sk_live_")
  const isLivePublishable = publishableKey.startsWith("pk_live_")

  console.log(`\n🔑 Key types:`)
  console.log(
    `Secret key: ${isTestSecret ? "TEST" : isLiveSecret ? "LIVE" : "UNKNOWN"}`,
  )
  console.log(
    `Publishable key: ${isTestPublishable ? "TEST" : isLivePublishable ? "LIVE" : "UNKNOWN"}`,
  )

  if (isTestSecret !== isTestPublishable) {
    console.error(
      "❌ Mismatch: Secret and publishable keys must both be test or both be live",
    )
    return
  }

  // Test Stripe API connection
  try {
    const stripe = new Stripe(secretKey, {
      apiVersion: "2025-02-24.acacia",
    })

    console.log("\n🧪 Testing Stripe API connection...")

    // Test account retrieval
    const account = await stripe.accounts.retrieve()
    console.log(
      `✅ Connected to Stripe account: ${account.business_profile?.name || account.id}`,
    )
    console.log(`Account type: ${account.type}`)
    console.log(`Country: ${account.country}`)
    console.log(`Charges enabled: ${account.charges_enabled}`)
    console.log(`Payouts enabled: ${account.payouts_enabled}`)

    if (!account.charges_enabled) {
      console.warn("⚠️  Charges are not enabled on this account")
    }

    if (!account.payouts_enabled) {
      console.warn("⚠️  Payouts are not enabled on this account")
    }

    // Test products and prices
    console.log("\n📦 Testing products and prices...")
    const products = await stripe.products.list({ limit: 10 })
    console.log(`✅ Found ${products.data.length} products`)

    const prices = await stripe.prices.list({ limit: 10 })
    console.log(`✅ Found ${prices.data.length} prices`)

    // Check for required lookup keys
    const requiredKeys = ["pro_monthly", "pro_yearly"]
    const existingKeys = prices.data.map((p) => p.lookup_key).filter(Boolean)

    console.log("\n🔍 Required lookup keys:")
    requiredKeys.forEach((key) => {
      if (existingKeys.includes(key)) {
        console.log(`  ✅ ${key} - Found`)
      } else {
        console.log(`  ❌ ${key} - Missing`)
      }
    })

    // Test customer creation
    console.log("\n👤 Testing customer creation...")
    const testCustomer = await stripe.customers.create({
      email: "test@example.com",
      metadata: { test: "true" },
    })
    console.log(`✅ Test customer created: ${testCustomer.id}`)

    // Clean up test customer
    await stripe.customers.del(testCustomer.id)
    console.log(`✅ Test customer deleted`)

    console.log("\n🎉 Stripe configuration verification complete!")
  } catch (error) {
    console.error("❌ Stripe API test failed:", error.message)

    if (error.type === "StripeAuthenticationError") {
      console.error("This usually means your API key is invalid or expired")
    } else if (error.type === "StripePermissionError") {
      console.error(
        "This usually means your API key lacks required permissions",
      )
    }
  }
}

verifyStripeConfig()
