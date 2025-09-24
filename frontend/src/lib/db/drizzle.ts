import { and, desc, eq, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { secrets, users } from "./schema";

// Database URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create the connection
const client = postgres(databaseUrl);
export const db = drizzle(client);

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
