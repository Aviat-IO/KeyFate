import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { secrets } from "./schema";
import { eq, and, desc, lt } from "drizzle-orm";

// Robust secrets service that handles potential schema mismatches
export class RobustSecretsService {
  private db: ReturnType<typeof drizzle>;

  constructor(databaseUrl: string) {
    const client = postgres(databaseUrl);
    this.db = drizzle(client);
  }

  async create(data: typeof secrets.$inferInsert) {
    try {
      // First attempt: use the standard approach
      const [result] = await this.db.insert(secrets).values(data).returning();
      return result;
    } catch (error) {
      // If we get a column error, try to diagnose and fix it
      if (error instanceof Error && error.message.includes('recipient_name')) {
        console.error('Schema mismatch detected:', error.message);

        // Check what columns actually exist
        const columnCheck = await this.db.execute(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'secrets'
          ORDER BY ordinal_position;
        `);

        // Handle different database client response formats
        const columns = Array.isArray(columnCheck) ? columnCheck : (columnCheck as { rows?: unknown[] }).rows || [];
        console.log('Available columns:', columns.map((r: { column_name?: string }) => r.column_name));

        // Check if the issue is a missing recipient_name column
        const hasRecipientName = columns.some((row: { column_name?: string }) => row.column_name === 'recipient_name');

        if (!hasRecipientName) {
          // Try to add the missing column
          try {
            await this.db.execute(`
              ALTER TABLE secrets
              ADD COLUMN IF NOT EXISTS recipient_name text NOT NULL DEFAULT '';
            `);

            console.log('Added missing recipient_name column');

            // Retry the insert
            const [result] = await this.db.insert(secrets).values(data).returning();
            return result;
          } catch (alterError) {
            console.error('Failed to add missing column:', alterError);
            throw new Error(`Schema mismatch: recipient_name column missing and cannot be added automatically`);
          }
        }
      }

      // Re-throw the original error if we couldn't handle it
      throw error;
    }
  }

  async getById(id: string, userId: string) {
    const [result] = await this.db
      .select()
      .from(secrets)
      .where(and(eq(secrets.id, id), eq(secrets.userId, userId)));

    return result;
  }

  async getAllByUser(userId: string) {
    return await this.db
      .select()
      .from(secrets)
      .where(eq(secrets.userId, userId))
      .orderBy(desc(secrets.createdAt));
  }

  async update(id: string, data: Partial<typeof secrets.$inferInsert>) {
    const [result] = await this.db
      .update(secrets)
      .set(data)
      .where(eq(secrets.id, id))
      .returning();

    return result;
  }

  async delete(id: string) {
    await this.db.delete(secrets).where(eq(secrets.id, id));
  }

  async getOverdue() {
    const now = new Date();
    return await this.db
      .select()
      .from(secrets)
      .where(
        and(
          eq(secrets.status, "active"),
          lt(secrets.nextCheckIn, now)
        )
      );
  }
}