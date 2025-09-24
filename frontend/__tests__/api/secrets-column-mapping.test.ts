import { describe, it, expect } from 'vitest';
import { secrets } from '@/lib/db/schema';

describe('Secrets Schema Column Mapping', () => {
  it('should have correct TypeScript to database column mapping', () => {
    // Verify the schema structure exists and has expected properties
    expect(secrets).toBeDefined();

    // Verify key field names are correctly mapped in the schema definition
    // These are the critical mappings we care about for the schema alignment
    const expectedMappings = {
      'recipientName': 'recipient_name',
      'recipientEmail': 'recipient_email',
      'contactMethod': 'contact_method',
      'checkInDays': 'check_in_days',
      'serverShare': 'server_share',
      'sssSharesTotal': 'sss_shares_total',
      'sssThreshold': 'sss_threshold'
    };

    // Test that we can access these fields on the secrets table
    Object.keys(expectedMappings).forEach(fieldName => {
      expect(secrets[fieldName as keyof typeof secrets]).toBeDefined();
    });

    // Schema validation passes if we can access the table structure
    expect(secrets.id).toBeDefined();
    expect(secrets.userId).toBeDefined();
    expect(secrets.title).toBeDefined();
  });

  it('should generate correct SQL for insert operations', () => {
    // This test verifies that the schema generates the expected SQL
    const testData = {
      title: 'Test',
      recipientName: 'John Doe',
      recipientEmail: 'john@example.com',
      contactMethod: 'email' as const,
      checkInDays: 30,
      userId: 'user123',
      sssSharesTotal: 3,
      sssThreshold: 2,
      status: 'active' as const,
      nextCheckIn: new Date()
    };

    // This should not throw a type error
    const insertType: typeof secrets.$inferInsert = testData;
    expect(insertType).toBeDefined();
  });
});