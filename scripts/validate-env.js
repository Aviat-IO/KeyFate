#!/usr/bin/env node

const required = {
  ENCRYPTION_KEY: (val) => {
    try {
      const decoded = Buffer.from(val, "base64")
      if (decoded.length !== 32) {
        throw new Error(
          "ENCRYPTION_KEY must be exactly 32 bytes when base64-decoded",
        )
      }
    } catch (err) {
      throw new Error(`ENCRYPTION_KEY validation failed: ${err.message}`)
    }
  },
  NEXTAUTH_SECRET: (val) => {
    if (val.length < 32) {
      throw new Error("NEXTAUTH_SECRET must be at least 32 characters")
    }
  },
  CRON_SECRET: (val) => {
    if (val.length < 32) {
      throw new Error("CRON_SECRET must be at least 32 characters")
    }
  },
  ADMIN_TOKEN: (val) => {
    if (val.length < 32) {
      throw new Error("ADMIN_TOKEN must be at least 32 characters")
    }
  },
  DATABASE_URL: (val) => {
    if (!val.startsWith("postgresql://") && !val.startsWith("postgres://")) {
      throw new Error(
        "DATABASE_URL must be a valid PostgreSQL connection string",
      )
    }
  },
  SENDGRID_API_KEY: () => {},
  SENDGRID_ADMIN_EMAIL: (val) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      throw new Error("SENDGRID_ADMIN_EMAIL must be a valid email address")
    }
  },
  NEXTAUTH_URL: (val) => {
    try {
      new URL(val)
    } catch {
      throw new Error("NEXTAUTH_URL must be a valid URL")
    }
  },
}

const optional = {
  STRIPE_SECRET_KEY: () => {},
  STRIPE_WEBHOOK_SECRET: () => {},
  BTCPAY_API_KEY: () => {},
  BTCPAY_STORE_ID: () => {},
  BTCPAY_URL: () => {},
  REDIS_URL: () => {},
  SENTRY_DSN: () => {},
}

let hasErrors = false

console.log("🔍 Validating environment variables...\n")

for (const [key, validate] of Object.entries(required)) {
  const value = process.env[key]
  if (!value) {
    console.error(`❌ FATAL: Required environment variable ${key} is not set`)
    hasErrors = true
    continue
  }
  try {
    validate(value)
    console.log(`✅ ${key}`)
  } catch (err) {
    console.error(`❌ FATAL: ${key} validation failed: ${err.message}`)
    hasErrors = true
  }
}

console.log("\n📋 Optional environment variables:")
for (const key of Object.keys(optional)) {
  const value = process.env[key]
  if (value) {
    console.log(`✅ ${key} (configured)`)
  } else {
    console.log(`⚠️  ${key} (not configured)`)
  }
}

if (hasErrors) {
  console.error(
    "\n❌ Environment validation failed. Please fix the errors above.",
  )
  process.exit(1)
}

console.log("\n✅ All required environment variables validated successfully")
