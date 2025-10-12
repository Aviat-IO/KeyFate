import { drizzle } from "drizzle-orm/postgres-js"
import * as schema from "./schema"
import { createPostgresConnection } from "./connection-parser"

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:dev_password_change_in_prod@localhost:5432/keyfate_dev"

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
