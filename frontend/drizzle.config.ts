import { defineConfig } from "drizzle-kit"
import * as dotenv from "dotenv"
import * as fs from "fs"

// Only load .env.local if it exists (local development)
// In production on Cloud Run, DATABASE_URL comes from Secret Manager
const envLocalPath = ".env.local"
if (fs.existsSync(envLocalPath)) {
  console.log("📄 Loading .env.local for local development")
  dotenv.config({ path: envLocalPath })
} else {
  console.log(
    "☁️  Running in Cloud Run, using environment variables from Secret Manager",
  )
}

// Validate DATABASE_URL is available
const databaseUrl = process.env.DATABASE_URL
console.log("DATABASE_URL type:", typeof databaseUrl)
console.log("DATABASE_URL length:", databaseUrl?.length)
console.log("DATABASE_URL first 80 chars:", databaseUrl?.substring(0, 80))

if (!databaseUrl) {
  console.error("❌ DATABASE_URL environment variable is not set")
  console.error(
    "Available env vars:",
    Object.keys(process.env)
      .filter((k) => k.includes("DATABASE") || k.includes("DB"))
      .join(", "),
  )
  throw new Error("DATABASE_URL is required for migrations")
}

console.log("✅ DATABASE_URL is configured for migrations")

const config = defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
})

// Log the database URL length directly instead of accessing config property
console.log("Drizzle config created with URL length:", databaseUrl.length)

export default config
