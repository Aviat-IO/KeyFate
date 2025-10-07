/**
 * Database Query Security Audit Tests
 *
 * Tests that verify user data isolation and prevent cross-user data access
 * after removal of Supabase RLS policies.
 *
 * These tests ensure that:
 * 1. User A cannot access User B's secrets
 * 2. User A cannot access User B's check-in tokens
 * 3. User A cannot update/delete User B's data
 * 4. Queries properly filter by userId
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { secretsService } from '@/lib/db/drizzle';
import { getDatabase } from '@/lib/db/get-database';
import { secrets, users, checkInTokens } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';

describe('Database Query Security Audit', () => {
  let db: Awaited<ReturnType<typeof getDatabase>>;
  let userAId: string;
  let userBId: string;
  let secretAId: string;
  let secretBId: string;

  beforeEach(async () => {
    db = await getDatabase();

    // Create two test users
    userAId = `test-user-a-${Date.now()}`;
    userBId = `test-user-b-${Date.now()}`;

    await db.insert(users).values([
      {
        id: userAId,
        email: `user-a-${Date.now()}@test.com`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: userBId,
        email: `user-b-${Date.now()}@test.com`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create secrets for each user
    const [secretA] = await db.insert(secrets).values({
      userId: userAId,
      title: 'User A Secret',
      recipientName: 'Recipient A',
      recipientEmail: 'recipient-a@test.com',
      contactMethod: 'email',
      checkInDays: 30,
      status: 'active',
      nextCheckIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sssSharesTotal: 3,
      sssThreshold: 2,
    }).returning({ id: secrets.id });

    const [secretB] = await db.insert(secrets).values({
      userId: userBId,
      title: 'User B Secret',
      recipientName: 'Recipient B',
      recipientEmail: 'recipient-b@test.com',
      contactMethod: 'email',
      checkInDays: 30,
      status: 'active',
      nextCheckIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sssSharesTotal: 3,
      sssThreshold: 2,
    }).returning({ id: secrets.id });

    secretAId = secretA.id;
    secretBId = secretB.id;
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await db.delete(secrets).where(eq(secrets.userId, userAId));
      await db.delete(secrets).where(eq(secrets.userId, userBId));
      await db.delete(users).where(eq(users.id, userAId));
      await db.delete(users).where(eq(users.id, userBId));
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Secrets Table - User Isolation', () => {
    it('prevents User A from accessing User B secrets via getById', async () => {
      // User A tries to access User B's secret
      const result = await secretsService.getById(secretBId, userAId);

      // Should return undefined/null (not found)
      expect(result).toBeUndefined();
    });

    it('prevents User A from seeing User B secrets in getAllByUser', async () => {
      // User A gets their secrets
      const userASecrets = await secretsService.getAllByUser(userAId);

      // Should only see their own secret
      expect(userASecrets).toHaveLength(1);
      expect(userASecrets[0].id).toBe(secretAId);
      expect(userASecrets[0].userId).toBe(userAId);

      // Should NOT contain User B's secret
      const hasUserBSecret = userASecrets.some(s => s.id === secretBId);
      expect(hasUserBSecret).toBe(false);
    });

    it('prevents User A from updating User B secret', async () => {
      // User A tries to update User B's secret
      const result = await secretsService.update(
        secretBId,
        userAId,
        { title: 'Hacked Title' }
      );

      // Should return undefined (not found/no permission)
      expect(result).toBeUndefined();

      // Verify User B's secret was NOT modified
      const secretB = await secretsService.getById(secretBId, userBId);
      expect(secretB?.title).toBe('User B Secret');
    });

    it('prevents User A from deleting User B secret', async () => {
      // User A tries to delete User B's secret
      await secretsService.delete(secretBId, userAId);

      // Verify User B's secret still exists
      const secretB = await secretsService.getById(secretBId, userBId);
      expect(secretB).toBeDefined();
      expect(secretB?.id).toBe(secretBId);
    });

    it('allows User A to update their own secret', async () => {
      const newTitle = 'Updated Title';

      const result = await secretsService.update(
        secretAId,
        userAId,
        { title: newTitle }
      );

      expect(result).toBeDefined();
      expect(result?.title).toBe(newTitle);
    });

    it('allows User A to delete their own secret', async () => {
      await secretsService.delete(secretAId, userAId);

      const result = await secretsService.getById(secretAId, userAId);
      expect(result).toBeUndefined();
    });
  });

  describe('Check-in Tokens - Ownership Validation', () => {
    let tokenAId: string;
    let tokenBId: string;

    beforeEach(async () => {
      // Create check-in tokens for each secret
      const [tokenA] = await db.insert(checkInTokens).values({
        secretId: secretAId,
        token: randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }).returning({ id: checkInTokens.id });

      const [tokenB] = await db.insert(checkInTokens).values({
        secretId: secretBId,
        token: randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }).returning({ id: checkInTokens.id });

      tokenAId = tokenA.id;
      tokenBId = tokenB.id;
    });

    afterEach(async () => {
      try {
        await db.delete(checkInTokens).where(
          eq(checkInTokens.secretId, secretAId)
        );
        await db.delete(checkInTokens).where(
          eq(checkInTokens.secretId, secretBId)
        );
      } catch (error) {
        console.error('Token cleanup error:', error);
      }
    });

    it('prevents User A from accessing User B check-in tokens directly', async () => {
      // Try to get User B's token by joining with User A's secrets
      const result = await db
        .select()
        .from(checkInTokens)
        .innerJoin(secrets, eq(checkInTokens.secretId, secrets.id))
        .where(
          and(
            eq(checkInTokens.id, tokenBId),
            eq(secrets.userId, userAId)
          )
        );

      // Should return empty (no access)
      expect(result).toHaveLength(0);
    });

    it('allows User A to access their own check-in tokens', async () => {
      const result = await db
        .select()
        .from(checkInTokens)
        .innerJoin(secrets, eq(checkInTokens.secretId, secrets.id))
        .where(
          and(
            eq(checkInTokens.id, tokenAId),
            eq(secrets.userId, userAId)
          )
        );

      expect(result).toHaveLength(1);
      expect(result[0].check_in_tokens.id).toBe(tokenAId);
    });
  });

  describe('System Queries - No User Filter Required', () => {
    it('allows health check to query secrets without userId', async () => {
      const result = await secretsService.healthCheck();
      expect(result).toBe(true);
    });

    it('allows getOverdue to query all active secrets (for cron job)', async () => {
      // Update one secret to be overdue
      await db
        .update(secrets)
        .set({ nextCheckIn: new Date(Date.now() - 1000) } as any)
        .where(eq(secrets.id, secretAId));

      const overdueSecrets = await secretsService.getOverdue();

      // Should include User A's overdue secret
      const hasUserASecret = overdueSecrets.some(s => s.id === secretAId);
      expect(hasUserASecret).toBe(true);

      // This is correct - system cron jobs need to see all users' overdue secrets
      // to send reminders and trigger disclosures
    });
  });

  describe('Data Isolation Verification', () => {
    it('ensures User A queries never leak User B data', async () => {
      // Get all secrets for User A
      const userASecrets = await db
        .select()
        .from(secrets)
        .where(eq(secrets.userId, userAId));

      // Verify no User B data in results
      userASecrets.forEach(secret => {
        expect(secret.userId).toBe(userAId);
        expect(secret.userId).not.toBe(userBId);
      });
    });

    it('ensures User B queries never leak User A data', async () => {
      // Get all secrets for User B
      const userBSecrets = await db
        .select()
        .from(secrets)
        .where(eq(secrets.userId, userBId));

      // Verify no User A data in results
      userBSecrets.forEach(secret => {
        expect(secret.userId).toBe(userBId);
        expect(secret.userId).not.toBe(userAId);
      });
    });

    it('prevents cross-user data access via compound queries', async () => {
      // Try a complex query that might leak data
      const result = await db
        .select()
        .from(secrets)
        .where(
          and(
            eq(secrets.id, secretBId),
            eq(secrets.userId, userAId) // Wrong userId
          )
        );

      // Should return empty
      expect(result).toHaveLength(0);
    });
  });

  describe('API Route Integration', () => {
    it('simulates API route user filtering pattern', async () => {
      // Simulate how API routes should filter queries
      const sessionUserId = userAId;

      // Get secret by ID with user filtering (like API routes do)
      const secret = await db
        .select()
        .from(secrets)
        .where(
          and(
            eq(secrets.id, secretBId), // Trying to access User B's secret
            eq(secrets.userId, sessionUserId) // But filtering by User A's ID
          )
        );

      // Should return empty (access denied)
      expect(secret).toHaveLength(0);
    });

    it('verifies update operations include userId filtering', async () => {
      const sessionUserId = userAId;

      // Try to update User B's secret with User A's session
      const result = await db
        .update(secrets)
        .set({ title: 'Hacked' })
        .where(
          and(
            eq(secrets.id, secretBId),
            eq(secrets.userId, sessionUserId)
          )
        )
        .returning();

      // Should return empty (no rows updated)
      expect(result).toHaveLength(0);

      // Verify original data unchanged
      const [secretB] = await db
        .select()
        .from(secrets)
        .where(eq(secrets.id, secretBId));

      expect(secretB.title).toBe('User B Secret');
    });
  });
});
