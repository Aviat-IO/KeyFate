import { drizzle } from 'drizzle-orm/postgres-js';
import { connectionManager } from './connection-manager';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// Singleton instance. The promise prevents concurrent first-use callers from
// creating competing pools before dbInstance is assigned.
let dbInstance: PostgresJsDatabase<typeof schema> | null = null;
let initializationPromise: Promise<PostgresJsDatabase<typeof schema>> | null = null;

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
export async function getDatabase(): Promise<PostgresJsDatabase<typeof schema>> {
	// Return the established instance or share one in-flight initialization.
	if (dbInstance) return dbInstance;
	if (initializationPromise) return initializationPromise;

	// Skip during build phase to prevent database connection attempts
	const isBuildTime = process.env.NODE_ENV === undefined;

	// Get connection string
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString && !isBuildTime) {
		throw new Error('DATABASE_URL environment variable is not set');
	}

	// During build time, return a mock database instance
	if (isBuildTime) {
		throw new Error('Database not available during build phase - this should not be called');
	}

	initializationPromise = (async () => {
		try {
			// Get connection with retry logic and circuit breaker
			const client = await connectionManager.getConnection(connectionString!, {
				max: 5, // Conservative pool size for Railway replicas
				idle_timeout: 20, // Close idle connections quickly
				connect_timeout: 10, // Fail fast on connection issues
				max_lifetime: 60 * 5 // Recycle connections every 5 minutes
			});

			dbInstance = drizzle(client, { schema });
			if (process.env.NODE_ENV === 'development') {
				console.log('✅ Database connection established');
			}
			return dbInstance;
		} catch (error) {
			dbInstance = null;
			console.error('❌ Database connection failed:', error);
			throw error;
		} finally {
			initializationPromise = null;
		}
	})();

	return initializationPromise;
}

/**
 * Get database stats for monitoring
 */
export function getDatabaseStats() {
	return connectionManager.getStats();
}

/**
 * Close database connection (for cleanup)
 */
export async function closeDatabaseConnection() {
	await initializationPromise?.catch(() => undefined);
	initializationPromise = null;
	dbInstance = null;
	await connectionManager.closeConnection();
}

// Re-export schema for convenience
export { schema };
