// Shared utility for parsing Cloud SQL Unix socket connections
import postgres, { Options as PostgresOptions } from "postgres"

interface UnixSocketConnectionOptions {
  host: string
  database: string
  username: string
  password: string | (() => string | Promise<string>)
  ssl: boolean | object | "require" | "allow" | "prefer" | "verify-full"
}

export function createPostgresConnection(
  connectionString: string,
  options: Partial<PostgresOptions<{}>> = {},
) {
  // Skip during build phase to prevent database connection attempts
  const isBuildTime =
    process.env.NODE_ENV === undefined ||
    process.env.NEXT_PHASE === "phase-production-build"

  if (!connectionString && !isBuildTime) {
    throw new Error("DATABASE_URL environment variable is not set")
  }

  // During build time, return null or throw a different error
  if (isBuildTime) {
    throw new Error("Database connections not available during build phase")
  }

  // Parse connection string for Cloud SQL Unix socket support
  let connectionOptions:
    | string
    | (UnixSocketConnectionOptions & Partial<PostgresOptions<{}>>)

  // Check if this is a Unix socket connection (for Cloud SQL)
  if (connectionString.includes("/cloudsql/")) {
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
        ...options,
      }

      console.log("Parsed Unix socket connection:", {
        host,
        database,
        username,
        passwordLength: password.length,
        source: "connection-parser",
      })

      // CRITICAL: Log which database we're connecting to
      console.log("🔍 DATABASE DEBUG - App connecting to database:", database)
    } else {
      console.error("Failed to parse Unix socket connection string")
      connectionOptions = connectionString
    }
  } else {
    // Standard TCP connection
    connectionOptions = connectionString

    // CRITICAL: Log which database we're connecting to for TCP connections too
    // Fix the regex to properly extract database name from standard PostgreSQL URLs
    const tcpMatch = connectionString.match(
      /postgresql:\/\/[^@]+@([^\/]+)\/([^?]+)/,
    )
    if (tcpMatch) {
      const host = tcpMatch[1]
      const database = tcpMatch[2]
      console.log("🔍 DATABASE DEBUG - TCP Connection:", {
        host,
        database,
        format: "standard TCP",
      })
    }
  }

  // Create the connection with proper configuration
  return typeof connectionOptions === "string"
    ? postgres(connectionOptions, {
        // For private IP connections within VPC, SSL is not required
        // The connection string will specify sslmode if needed
        ssl: false,
        connect_timeout: 30, // Increase timeout to 30 seconds
        ...options,
      })
    : postgres({ ...connectionOptions, ...options })
}
