import { and, desc, eq, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { secrets, users } from "./schema";
import { createPostgresConnection } from "./connection-parser";

// Create a SINGLE shared connection instance with proper pooling
// Reuse this same instance across all database operations
let client: ReturnType<typeof createPostgresConnection> | null = null;

function getClient() {
  if (!client) {
    console.log('🔍 DRIZZLE DEBUG - Creating new database connection');
    console.log('🔍 DRIZZLE DEBUG - DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@')); // Hide password
    client = createPostgresConnection(process.env.DATABASE_URL!, {
      max: 10,  // Reduce max connections to avoid exhausting VPC connector
      idle_timeout: 60,  // Close idle connections faster
      connect_timeout: 30,  // 30 second timeout
    });
  }
  return client;
}

export const db = drizzle(getClient());

// CRITICAL DEBUG: Test database connection and verify which database/schema we're in
// Only run this debug code in non-production or when debugging
if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_DB === 'true') {
  (async () => {
    try {
      const testClient = getClient();
      const currentDb = await testClient`SELECT current_database() as db, current_schema() as schema`;
      console.log('🔍 DRIZZLE DEBUG - Connected to:', currentDb[0]);

      // Check if secrets table exists in current schema
      const tableExists = await testClient`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = current_schema()
          AND table_name = 'secrets'
        ) as exists
      `;
      console.log('🔍 DRIZZLE DEBUG - Secrets table exists in current schema:', tableExists[0]);

      // List all tables in ALL schemas
      const allTables = await testClient`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
        ORDER BY table_schema, table_name
      `;
      console.log('🔍 DRIZZLE DEBUG - All tables in database:', allTables.map(t => `${t.table_schema}.${t.table_name}`));
    } catch (error) {
      console.error('🔍 DRIZZLE DEBUG - Database test failed:', error);
    }
  })();
}

// Export tables for use in auth configuration
export { users };

// Database service functions using Drizzle
export const secretsService = {
  async create(data: typeof secrets.$inferInsert) {
    const [result] = await db.insert(secrets).values(data).returning();
    return result;
  },

  async getById(id: string, userId: string) {
    const [result] = await db
      .select()
      .from(secrets)
      .where(and(eq(secrets.id, id), eq(secrets.userId, userId)));

    return result;
  },

  async getAllByUser(userId: string) {
    return await db
      .select()
      .from(secrets)
      .where(eq(secrets.userId, userId))
      .orderBy(desc(secrets.createdAt));
  },

  async update(id: string, data: Partial<typeof secrets.$inferInsert>) {
    const [result] = await db
      .update(secrets)
      .set(data)
      .where(eq(secrets.id, id))
      .returning();

    return result;
  },

  async delete(id: string) {
    await db.delete(secrets).where(eq(secrets.id, id));
  },

  async getOverdue() {
    const now = new Date();
    return await db
      .select()
      .from(secrets)
      .where(
        and(
          eq(secrets.status, "active"),
          lt(secrets.nextCheckIn, now),
        ),
      );
  },
};
