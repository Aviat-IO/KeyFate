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
if (!process.env.DATABASE_URL) {
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

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
})
