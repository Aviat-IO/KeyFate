/**
 * @jest-environment node
 *
 * Task 23: Drizzle ORM Cloud SQL Compatibility Tests
 * TDD Implementation - Verify Drizzle works correctly with Cloud SQL PostgreSQL
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getDatabase } from '@/lib/db/get-database';
import { emailFailures } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Drizzle ORM Cloud SQL Compatibility', () => {
  let db: Awaited<ReturnType<typeof getDatabase>>;

  beforeAll(async () => {
    // Get database instance using new async pattern
    db = await getDatabase();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db.delete(emailFailures).where(eq(emailFailures.recipient, 'test-drizzle@example.com'));
  });

  afterAll(async () => {
    // Cleanup after tests
    await db.delete(emailFailures).where(eq(emailFailures.recipient, 'test-drizzle@example.com'));
  });

  it('should successfully insert and return data using .returning()', async () => {
    const testData = {
      emailType: 'reminder' as const,
      provider: 'console-dev' as const,
      recipient: 'test-drizzle@example.com',
      subject: 'Test Email',
      errorMessage: 'Test error',
      retryCount: 0,
    };

    const [inserted] = await db
      .insert(emailFailures)
      .values(testData)
      .returning();

    expect(inserted).toBeDefined();
    expect(inserted.id).toBeDefined();
    expect(inserted.emailType).toBe('reminder');
    expect(inserted.recipient).toBe('test-drizzle@example.com');
    expect(inserted.errorMessage).toBe('Test error');
    expect(inserted.retryCount).toBe(0);
  });

  it('should successfully update and return data using .returning()', async () => {
    // First insert a record
    const [inserted] = await db
      .insert(emailFailures)
      .values({
        emailType: 'verification' as const,
        provider: 'console-dev' as const,
        recipient: 'test-drizzle@example.com',
        subject: 'Test Update',
        errorMessage: 'Original error',
        retryCount: 0,
      })
      .returning();

    // Now update it
    const [updated] = await db
      .update(emailFailures)
      .set({ retryCount: 1, errorMessage: 'Updated error' })
      .where(eq(emailFailures.id, inserted.id))
      .returning();

    expect(updated).toBeDefined();
    expect(updated.id).toBe(inserted.id);
    expect(updated.retryCount).toBe(1);
    expect(updated.errorMessage).toBe('Updated error');
  });

  it('should successfully select data without undefined errors', async () => {
    // Insert test data
    const [inserted] = await db
      .insert(emailFailures)
      .values({
        emailType: 'disclosure' as const,
        provider: 'sendgrid' as const,
        recipient: 'test-drizzle@example.com',
        subject: 'Test Select',
        errorMessage: 'Test error',
        retryCount: 2,
      })
      .returning();

    // Now select it
    const [selected] = await db
      .select()
      .from(emailFailures)
      .where(eq(emailFailures.id, inserted.id))
      .limit(1);

    expect(selected).toBeDefined();
    expect(selected.id).toBe(inserted.id);
    expect(selected.emailType).toBe('disclosure');
    expect(selected.retryCount).toBe(2);
  });

  it('should handle complex queries with multiple conditions', async () => {
    // Insert multiple test records
    await db.insert(emailFailures).values([
      {
        emailType: 'reminder' as const,
        provider: 'console-dev' as const,
        recipient: 'test-drizzle@example.com',
        subject: 'Test 1',
        errorMessage: 'Error 1',
        retryCount: 0,
      },
      {
        emailType: 'reminder' as const,
        provider: 'sendgrid' as const,
        recipient: 'test-drizzle@example.com',
        subject: 'Test 2',
        errorMessage: 'Error 2',
        retryCount: 1,
      },
    ]);

    // Query with multiple conditions
    const results = await db
      .select()
      .from(emailFailures)
      .where(eq(emailFailures.recipient, 'test-drizzle@example.com'));

    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every(r => r.recipient === 'test-drizzle@example.com')).toBe(true);
    expect(results.every(r => r.id !== undefined)).toBe(true);
  });

  it('should handle delete operations correctly', async () => {
    // Insert test data
    const [inserted] = await db
      .insert(emailFailures)
      .values({
        emailType: 'admin_notification' as const,
        provider: 'console-dev' as const,
        recipient: 'test-drizzle@example.com',
        subject: 'Test Delete',
        errorMessage: 'Test error',
        retryCount: 0,
      })
      .returning();

    // Delete it
    await db.delete(emailFailures).where(eq(emailFailures.id, inserted.id));

    // Verify deletion
    const [deleted] = await db
      .select()
      .from(emailFailures)
      .where(eq(emailFailures.id, inserted.id))
      .limit(1);

    expect(deleted).toBeUndefined();
  });

  it('should verify database connection is working', async () => {
    // Simple query to verify connection
    const result = await db.select().from(emailFailures).limit(1);

    // Result should be an array (even if empty)
    expect(Array.isArray(result)).toBe(true);
  });
});
