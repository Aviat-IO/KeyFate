import { drizzle } from "drizzle-orm/postgres-js"
import { connectionManager } from "./connection-manager"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import * as schema from "./schema"

// Singleton instance
let dbInstance: PostgresJsDatabase<typeof schema> | null = null

/**
 * Get a database instance with proper connection management.
 * This is the standard way to get a database connection throughout the application.
 *
 * Features:
 * - Singleton pattern to reuse connections
 * - Automatic retry logic via connectionManager
 * - Circuit breaker pattern for failure protection
 * - Connection pooling with optimized settings
 *
 * @returns Promise<PostgresJsDatabase> Drizzle database instance
 * @throws Error if DATABASE_URL is not set or connection fails after retries
 */
export async function getDatabase(): Promise<
  PostgresJsDatabase<typeof schema>
> {
  // Return existing instance if available
  if (dbInstance) {
    return dbInstance
  }

  // Skip during build phase to prevent database connection attempts
  const isBuildTime =
    process.env.NODE_ENV === undefined ||
    process.env.NEXT_PHASE === "phase-production-build"

  // Get connection string
  const connectionString = process.env.DATABASE_URL
  if (!connectionString && !isBuildTime) {
    throw new Error("DATABASE_URL environment variable is not set")
  }

  // During build time, return a mock database instance
  if (isBuildTime) {
    throw new Error(
      "Database not available during build phase - this should not be called",
    )
  }

  try {
    // Get connection with retry logic and circuit breaker
    const client = await connectionManager.getConnection(connectionString!, {
      max: 5, // Conservative pool size for Cloud Run
      idle_timeout: 20, // Close idle connections quickly
      connect_timeout: 10, // Fail fast on connection issues
      max_lifetime: 60 * 5, // Recycle connections every 5 minutes
    })

    // Create Drizzle instance
    dbInstance = drizzle(client, { schema })

    // Log success in development
    if (process.env.NODE_ENV === "development") {
      console.log("✅ Database connection established")
    }

    return dbInstance
  } catch (error) {
    // Reset instance on failure
    dbInstance = null

    // Log error details
    console.error("❌ Database connection failed:", error)

    // Re-throw for caller to handle
    throw error
  }
}

/**
 * Get database stats for monitoring
 */
export function getDatabaseStats() {
  return connectionManager.getStats()
}

/**
 * Close database connection (for cleanup)
 */
export async function closeDatabaseConnection() {
  dbInstance = null
  await connectionManager.closeConnection()
}

// Re-export schema for convenience
export { schema }
