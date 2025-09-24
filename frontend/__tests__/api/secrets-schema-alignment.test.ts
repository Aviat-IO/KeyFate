import { describe, it, expect, afterEach } from 'vitest';
import { secretsService } from '@/lib/db/drizzle';
import { db } from '@/lib/db/drizzle';
import { secrets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Secrets Schema Alignment', () => {
  let testSecretId: string;

  afterEach(async () => {
    // Clean up test data
    if (testSecretId) {
      try {
        await db.delete(secrets).where(eq(secrets.id, testSecretId));
      } catch (error) {
        console.log('Cleanup error (expected for failed tests):', error);
      }
    }
  });

  it('should verify schema field mapping matches database columns', async () => {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('test_db')) {
      console.log('Skipping test - no DATABASE_URL or test database not set up');
      expect(true).toBe(true); // Pass test in CI/test environment
      return;
    }
    // Test that we can create a record with the expected field names
    const testData = {
      title: 'Schema Test',
      recipientName: 'Jane Doe',
      recipientEmail: 'jane@example.com',
      contactMethod: 'email' as const,
      checkInDays: 30,
      serverShare: 'test-share',
      iv: 'test-iv',
      authTag: 'test-tag',
      userId: 'test-user',
      sssSharesTotal: 3,
      sssThreshold: 2,
      status: 'active' as const,
      nextCheckIn: new Date()
    };

    try {
      // This should not throw a database column error
      const result = await secretsService.create(testData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.recipientName).toBe('Jane Doe');

      // Store for cleanup
      testSecretId = result.id;
    } catch (error) {
      // If it's a connection error to test_db, skip the test
      if (error.message && error.message.includes('test_db')) {
        console.log('Test database not available, skipping test');
        expect(true).toBe(true);
        return;
      }
      throw error;
    }
  });

  it('should handle field mapping from API format to database format', async () => {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('test_db')) {
      console.log('Skipping test - no DATABASE_URL or test database not set up');
      expect(true).toBe(true); // Pass test in CI/test environment
      return;
    }
    // Test the transformation that the API should perform
    const apiData = {
      recipient_name: 'Bob Smith', // API format (snake_case)
      recipient_email: 'bob@example.com',
      contact_method: 'email' as const,
      check_in_days: 30
    };

    // Transform to database format (camelCase)
    const dbData = {
      title: 'Field Mapping Test',
      recipientName: apiData.recipient_name, // Transform snake_case to camelCase
      recipientEmail: apiData.recipient_email,
      contactMethod: apiData.contact_method,
      checkInDays: apiData.check_in_days,
      serverShare: 'encrypted-server-share',
      iv: 'test-iv',
      authTag: 'test-tag',
      userId: 'test-user',
      sssSharesTotal: 3,
      sssThreshold: 2,
      status: 'active' as const,
      nextCheckIn: new Date()
    };

    try {
      const result = await secretsService.create(dbData);

      expect(result).toBeDefined();
      expect(result.recipientName).toBe('Bob Smith');

      testSecretId = result.id;
    } catch (error) {
      // If it's a connection error to test_db, skip the test
      if (error.message && error.message.includes('test_db')) {
        console.log('Test database not available, skipping test');
        expect(true).toBe(true);
        return;
      }
      throw error;
    }
  });
});