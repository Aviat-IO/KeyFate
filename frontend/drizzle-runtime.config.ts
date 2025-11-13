import { defineConfig } from "drizzle-kit"

// Runtime configuration for Cloud Run - uses DATABASE_URL from environment
// This config works with Unix socket connections to Cloud SQL
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    table: "journal",
    schema: "drizzle",
  },
})
# Journal populated Thu Nov 13 12:45:12 MST 2025
