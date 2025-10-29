import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

// Database connection configuration
// Skip database setup during build phase
const isBuildTime =
  process.env.NODE_ENV === undefined ||
  process.env.NEXT_PHASE === "phase-production-build"

const connectionString = process.env.DATABASE_URL

if (!connectionString && !isBuildTime) {
  throw new Error("DATABASE_URL environment variable is not set")
}

// Parse connection string for Cloud SQL Unix socket support
let connectionOptions: any = {}

// Check if this is a Unix socket connection (for Cloud SQL)
if (connectionString && connectionString.includes("/cloudsql/")) {
  // Manual parsing for Unix socket format with special characters in password
  // Format: postgresql://username:password@/database?host=/cloudsql/PROJECT:REGION:INSTANCE

  // Extract username
  const usernameMatch = connectionString.match(/^postgresql:\/\/([^:]+):/)
  const username = usernameMatch ? usernameMatch[1] : ""

  // Extract database and host
  const dbHostMatch = connectionString.match(/@\/([^?]+)\?host=([^&\s]+)/)
  const database = dbHostMatch ? dbHostMatch[1] : ""
  const host = dbHostMatch ? dbHostMatch[2] : ""

  // Extract password - it's between "username:" and "@/database"
  const passwordStart =
    connectionString.indexOf(`${username}:`) + username.length + 1
  const passwordEnd = connectionString.indexOf(`@/${database}`)
  const password = connectionString.substring(passwordStart, passwordEnd)

  if (username && database && host && password) {
    connectionOptions = {
      host, // Unix socket path: /cloudsql/PROJECT:REGION:INSTANCE
      database,
      username,
      password, // Keep password as-is, including special characters
      ssl: false, // Unix sockets don't need SSL
    }

    // Only log in development with explicit debug flag
    if (process.env.DEBUG_DB === "true") {
      console.log("Parsed Unix socket connection:", {
        host,
        database,
      })
    }
  } else {
    console.error("Failed to parse Unix socket connection string")
    connectionOptions = connectionString
  }
} else {
  // Standard TCP connection
  connectionOptions = connectionString
}

// Enhanced connection configuration with pooling
const connectionConfig = {
  // Use parsed options or connection string
  ...(typeof connectionOptions === "object" ? connectionOptions : {}),

  // SSL configuration - only for TCP connections
  ssl:
    typeof connectionOptions === "string" &&
    process.env.NODE_ENV === "production"
      ? ("require" as const)
      : false,

  // Connection pooling settings
  max: parseInt(process.env.DB_POOL_MAX || "20"), // Maximum connections in pool
  min: parseInt(process.env.DB_POOL_MIN || "5"), // Minimum connections to maintain

  // Timeout settings
  idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || "600"), // 10 minutes
  connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || "15"), // 15 seconds

  // Performance settings
  prepare: false, // Disable prepared statements for better pooling
  transform: postgres.camel, // Transform snake_case to camelCase

  // Connection lifecycle
  onnotice: process.env.NODE_ENV === "development" ? console.log : undefined,
  debug:
    process.env.NODE_ENV === "development" && process.env.DB_DEBUG === "true",

  // Connection validation
  connection: {
    application_name: "keyfate-app",
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || "30000"), // 30 seconds in ms
  },
}

// Debug logging only when DEBUG_DB is enabled
if (process.env.DEBUG_DB === "true" && typeof connectionOptions === "object") {
  console.log("Database connection config:", {
    database: connectionOptions.database,
    ssl: connectionOptions.ssl,
  })
}

// Create the connection with enhanced configuration (only at runtime)
// Use lazy initialization to prevent build-time errors
let client: any = null
let db: any = null

// Lazy initialization function
function initializeDatabase() {
  if (client) return { client, db }

  if (isBuildTime) {
    throw new Error("Database not available during build phase")
  }

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set")
  }

  client =
    typeof connectionOptions === "string"
      ? postgres(connectionOptions, connectionConfig)
      : postgres(connectionConfig)

  // Create Drizzle database instance
  db = drizzle(client, { schema })

  return { client, db }
}

// Export the database instance (will be null during build)
export { db, client }

// Connection health check
export async function checkDatabaseConnection(): Promise<boolean> {
  // During build time, return false but don't throw
  if (isBuildTime) {
    return false
  }

  try {
    const { client: dbClient } = initializeDatabase()
    await dbClient`SELECT 1`
    return true
  } catch (error) {
    console.error("Database connection failed:", error)
    return false
  }
}

// Connection pool monitoring
export function getConnectionPoolStats() {
  // Note: postgres.js doesn't expose detailed pool stats directly
  // These are the configured values, not runtime stats
  return {
    maxConnections: connectionConfig.max,
    minConnections: connectionConfig.min,
    // Runtime stats would need to be tracked separately or use database queries
    // to check pg_stat_activity for actual connection counts
  }
}

// Enhanced health check with pool status
export async function checkDatabaseConnectionHealth(): Promise<{
  isHealthy: boolean
  poolStats: ReturnType<typeof getConnectionPoolStats>
  responseTime: number
  error?: string
}> {
  const startTime = Date.now()

  // During build time, return safe defaults
  if (isBuildTime) {
    return {
      isHealthy: false,
      poolStats: getConnectionPoolStats(),
      responseTime: 0,
      error: "Database not available during build phase",
    }
  }

  try {
    const { client: dbClient } = initializeDatabase()
    await dbClient`SELECT 1 as health_check`
    const responseTime = Date.now() - startTime

    return {
      isHealthy: true,
      poolStats: getConnectionPoolStats(),
      responseTime,
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    console.error("Database health check failed:", error)

    return {
      isHealthy: false,
      poolStats: getConnectionPoolStats(),
      responseTime,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Set user context for RLS (Row Level Security)
export async function setUserContext(userId: string): Promise<void> {
  if (isBuildTime) {
    return // Skip during build time
  }
  const { client: dbClient } = initializeDatabase()
  await dbClient`SELECT set_current_user_id(${userId})`
}

// Graceful shutdown with pool cleanup
export async function closeDatabaseConnection(): Promise<void> {
  if (isBuildTime || !client) {
    return // Skip during build time or if not initialized
  }
  console.log("Closing database connection pool...")
  await client.end({ timeout: 5 })
  console.log("Database connection pool closed.")
  client = null
  db = null
}
