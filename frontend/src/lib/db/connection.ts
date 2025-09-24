import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Database connection configuration
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Enhanced connection configuration with pooling
const connectionConfig = {
  // SSL configuration - use proper type for postgres.js
  ssl: process.env.NODE_ENV === "production" ? ("require" as const) : false,

  // Connection pooling settings
  max: parseInt(process.env.DB_POOL_MAX || "20"), // Maximum connections in pool
  min: parseInt(process.env.DB_POOL_MIN || "5"),  // Minimum connections to maintain

  // Timeout settings
  idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || "600"), // 10 minutes
  connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || "15"), // 15 seconds

  // Performance settings
  prepare: false, // Disable prepared statements for better pooling
  transform: postgres.camel, // Transform snake_case to camelCase

  // Connection lifecycle
  onnotice: process.env.NODE_ENV === "development" ? console.log : undefined,
  debug: process.env.NODE_ENV === "development" && process.env.DB_DEBUG === "true",

  // Connection validation
  connection: {
    application_name: "keyfate-app",
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || "30000"), // 30 seconds in ms
  },
};

// Create the connection with enhanced configuration
const client = postgres(connectionString, connectionConfig);

// Create Drizzle database instance
export const db = drizzle(client, { schema });

// Export the client for raw queries if needed
export { client };

// Connection health check
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
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
  };
}

// Enhanced health check with pool status
export async function checkDatabaseConnectionHealth(): Promise<{
  isHealthy: boolean;
  poolStats: ReturnType<typeof getConnectionPoolStats>;
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    await client`SELECT 1 as health_check`;
    const responseTime = Date.now() - startTime;

    return {
      isHealthy: true,
      poolStats: getConnectionPoolStats(),
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error("Database health check failed:", error);

    return {
      isHealthy: false,
      poolStats: getConnectionPoolStats(),
      responseTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Set user context for RLS (Row Level Security)
export async function setUserContext(userId: string): Promise<void> {
  await client`SELECT set_current_user_id(${userId})`;
}

// Graceful shutdown with pool cleanup
export async function closeDatabaseConnection(): Promise<void> {
  console.log("Closing database connection pool...");
  await client.end({ timeout: 5 });
  console.log("Database connection pool closed.");
}