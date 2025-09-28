import { and, desc, eq, lt } from "drizzle-orm";
import { secrets, users } from "./schema";
import { connectionManager } from "./connection-manager";
import { getDatabase } from "./get-database";

// Re-export the standardized database getter
export { getDatabase, getDatabase as getDb };

// DEPRECATED: This proxy-based db export is kept for backward compatibility
// but should not be used in new code. Use getDatabase() instead.
// This proxy will throw an error if the database is not initialized.
let dbInstance: any = null;
export const db = new Proxy({} as any, {
  get(target, prop, receiver) {
    if (!dbInstance) {
      throw new Error('Database not initialized. Please use getDatabase() instead of direct db access.');
    }
    return Reflect.get(dbInstance, prop, receiver);
  }
});

// Pre-initialize for legacy code that expects synchronous access
// Skip during build phase to prevent database connection attempts
(async () => {
  const isBuildTime = process.env.NODE_ENV === undefined ||
                     process.env.NEXT_PHASE === 'phase-production-build' ||
                     process.env.NODE_ENV === 'test';

  if (!isBuildTime) {
    try {
      dbInstance = await getDatabase();
      console.log('🚀 DRIZZLE - Database pre-initialized for legacy code');
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
    const database = await getDatabase();
    const [result] = await database.insert(secrets).values(data).returning();
    return result;
  },

  async getById(id: string, userId: string) {
    const database = await getDatabase();
    const [result] = await database
      .select()
      .from(secrets)
      .where(and(eq(secrets.id, id), eq(secrets.userId, userId)));

    return result;
  },

  async getAllByUser(userId: string) {
    const database = await getDatabase();
    return await database
      .select()
      .from(secrets)
      .where(eq(secrets.userId, userId))
      .orderBy(desc(secrets.createdAt));
  },

  async update(id: string, data: Partial<typeof secrets.$inferInsert>) {
    const database = await getDatabase();
    const [result] = await database
      .update(secrets)
      .set(data)
      .where(eq(secrets.id, id))
      .returning();

    return result;
  },

  async delete(id: string) {
    const database = await getDatabase();
    await database.delete(secrets).where(eq(secrets.id, id));
  },

  async getOverdue() {
    const database = await getDatabase();
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
      const database = await getDatabase();
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