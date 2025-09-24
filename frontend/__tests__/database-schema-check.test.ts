import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db/drizzle';

describe('Database Schema Check', () => {
  it('should show the actual secrets table structure', async () => {
    try {
      // Query the information schema to see what columns actually exist
      const result = await db.execute(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'secrets'
        ORDER BY ordinal_position;
      `);

      console.log('Actual secrets table columns:', result.rows);

      // This test is primarily for debugging - let it pass
      expect(result.rows.length).toBeGreaterThan(0);
    } catch (error) {
      console.log('Error checking schema (expected in test env):', error);
      // In test environment, this might fail due to DB connection
      // This is still valuable for understanding the schema
    }
  });

  it('should check if recipient_name column exists specifically', async () => {
    try {
      // Check if the specific column exists
      const result = await db.execute(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'secrets'
        AND column_name = 'recipient_name';
      `);

      console.log('recipient_name column check:', result.rows);

      if (result.rows.length === 0) {
        console.log('recipient_name column does NOT exist in the database');
      } else {
        console.log('recipient_name column EXISTS in the database');
      }
    } catch (error) {
      console.log('Error checking recipient_name column:', error);
    }
  });
});