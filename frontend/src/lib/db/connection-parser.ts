// Shared utility for parsing Cloud SQL Unix socket connections
import postgres from "postgres";

export function createPostgresConnection(connectionString: string, options: any = {}) {
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Parse connection string for Cloud SQL Unix socket support
  let connectionOptions: any = {};

  // Check if this is a Unix socket connection (for Cloud SQL)
  if (connectionString.includes("/cloudsql/")) {
    // Manual parsing for Unix socket format with special characters in password
    // Format: postgresql://username:password@/database?host=/cloudsql/PROJECT:REGION:INSTANCE

    // Extract username
    const usernameMatch = connectionString.match(/^postgresql:\/\/([^:]+):/);
    const username = usernameMatch ? usernameMatch[1] : '';

    // Extract database and host
    const dbHostMatch = connectionString.match(/@\/([^?]+)\?host=([^&\s]+)/);
    const database = dbHostMatch ? dbHostMatch[1] : '';
    const host = dbHostMatch ? dbHostMatch[2] : '';

    // Extract password - it's between "username:" and "@/database"
    const passwordStart = connectionString.indexOf(`${username}:`) + username.length + 1;
    const passwordEnd = connectionString.indexOf(`@/${database}`);
    const password = connectionString.substring(passwordStart, passwordEnd);

    if (username && database && host && password) {
      connectionOptions = {
        host,      // Unix socket path: /cloudsql/PROJECT:REGION:INSTANCE
        database,
        username,
        password,  // Keep password as-is, including special characters
        ssl: false, // Unix sockets don't need SSL
        ...options
      };

      console.log('Parsed Unix socket connection:', {
        host,
        database,
        username,
        passwordLength: password.length,
        source: 'connection-parser'
      });

      // CRITICAL: Log which database we're connecting to
      console.log('🔍 DATABASE DEBUG - App connecting to database:', database);
    } else {
      console.error('Failed to parse Unix socket connection string');
      connectionOptions = connectionString;
    }
  } else {
    // Standard TCP connection
    connectionOptions = connectionString;

    // CRITICAL: Log which database we're connecting to for TCP connections too
    const dbMatch = connectionString.match(/\/([^?]+)(\?|$)/);
    const database = dbMatch ? dbMatch[1] : 'unknown';
    console.log('🔍 DATABASE DEBUG - App connecting to database via TCP:', database);
  }

  // Create the connection with proper configuration
  return typeof connectionOptions === 'string'
    ? postgres(connectionOptions, {
        ssl: process.env.NODE_ENV === "production" ? "require" : false,
        ...options
      })
    : postgres({ ...connectionOptions, ...options });
}