import { drizzle } from "drizzle-orm/postgres-js"
import * as schema from "./schema"
import { createPostgresConnection } from "./connection-parser"

// Build DATABASE_URL from component parts if not provided directly
function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  // Try to construct from component parts (for Doppler)
  const dbHost = process.env.DB_HOST || "localhost"
  const dbPort = process.env.DB_PORT || "5432"
  const dbUser = process.env.DB_USER || "postgres"
  const dbPassword = process.env.DB_PASSWORD || "dev_password_change_in_prod"
  const dbName = process.env.DB_NAME || "keyfate_dev"

  return `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`
}

const connectionString = getDatabaseUrl()

// For migrations and single queries
const migrationClient = createPostgresConnection(connectionString, { max: 1 })

// For application use
const queryClient = createPostgresConnection(connectionString)

// Create the drizzle database instance
export const db = drizzle(queryClient, {
  schema,
})

// Export for migrations
export const migrationDb = drizzle(migrationClient, {
  schema,
})

// Export schema for use in other files
export * from "./schema"
