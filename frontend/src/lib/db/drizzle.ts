import { and, desc, eq, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { secrets, users } from "./schema";
import { connectionManager } from "./connection-manager";

// Create database instance with enhanced connection management
let dbInstance: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (!dbInstance) {
    try {
      console.log('🔍 DRIZZLE - Initializing database connection');
      const connectionString = process.env.DATABASE_URL;

      if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not set');
      }

      // Log connection string (with password hidden)
      console.log('🔍 DRIZZLE - DATABASE_URL:', connectionString.replace(/:[^:@]+@/, ':***@'));

      // Get connection with retry logic and circuit breaker
      const client = await connectionManager.getConnection(connectionString, {
        max: 5, // Conservative pool size
        idle_timeout: 20, // Close idle connections quickly
        connect_timeout: 10, // Fail fast on connection issues
        max_lifetime: 60 * 5, // Recycle connections every 5 minutes
      });

      dbInstance = drizzle(client);
      console.log('✅ DRIZZLE - Database instance created successfully');

      // Verify table access
      if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_DB === 'true') {
        try {
          const testQuery = await client`
            SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_schema = 'public'
              AND table_name = 'secrets'
            ) as exists
          `;
          console.log('🔍 DRIZZLE - Secrets table exists:', testQuery[0].exists);
        } catch (error) {
          console.error('🔍 DRIZZLE - Table verification failed:', error);
        }
      }
    } catch (error) {
      console.error('❌ DRIZZLE - Failed to initialize database:', error);
      dbInstance = null;
      throw error;
    }
  }
  return dbInstance;
}

// Export a proxy that initializes on first use
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop, receiver) {
    // For async initialization, we need to handle this differently
    // This is a synchronous proxy, so we'll throw an error if not initialized
    if (!dbInstance) {
      throw new Error('Database not initialized. Please ensure database operations are wrapped in try-catch blocks.');
    }
    return Reflect.get(dbInstance, prop, receiver);
  }
});

// Initialize database on module load for cron endpoints
// This ensures the connection is ready when needed
(async () => {
  if (process.env.NODE_ENV !== 'test') {
    try {
      await getDb();
      console.log('🚀 DRIZZLE - Database pre-initialized for cron endpoints');
    } catch (error) {
      console.error('⚠️ DRIZZLE - Database pre-initialization failed (will retry on first use):', error);
    }
  }
})();

// Export tables for use in auth configuration
export { users };

// Enhanced database service functions with error handling and retries
export const secretsService = {
  async create(data: typeof secrets.$inferInsert) {
    const database = await getDb();
    const [result] = await database.insert(secrets).values(data).returning();
    return result;
  },

  async getById(id: string, userId: string) {
    const database = await getDb();
    const [result] = await database
      .select()
      .from(secrets)
      .where(and(eq(secrets.id, id), eq(secrets.userId, userId)));

    return result;
  },

  async getAllByUser(userId: string) {
    const database = await getDb();
    return await database
      .select()
      .from(secrets)
      .where(eq(secrets.userId, userId))
      .orderBy(desc(secrets.createdAt));
  },

  async update(id: string, data: Partial<typeof secrets.$inferInsert>) {
    const database = await getDb();
    const [result] = await database
      .update(secrets)
      .set(data)
      .where(eq(secrets.id, id))
      .returning();

    return result;
  },

  async delete(id: string) {
    const database = await getDb();
    await database.delete(secrets).where(eq(secrets.id, id));
  },

  async getOverdue() {
    const database = await getDb();
    const now = new Date();
    return await database
      .select()
      .from(secrets)
      .where(
        and(
          eq(secrets.status, "active"),
          lt(secrets.nextCheckIn, now),
        ),
      );
  },

  // Health check method for monitoring
  async healthCheck(): Promise<boolean> {
    try {
      const database = await getDb();
      await database.select().from(secrets).limit(1);
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
};

// Export connection manager for monitoring
export { connectionManager };