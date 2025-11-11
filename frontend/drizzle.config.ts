import { defineConfig } from "drizzle-kit"
import * as dotenv from "dotenv"

// Load environment variables from .env.local (only in local dev, Cloud Run uses Secret Manager)
// In production, DATABASE_URL is injected by Cloud Run from Secret Manager
dotenv.config({ path: ".env.local" })

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
