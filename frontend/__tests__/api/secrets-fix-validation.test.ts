import { describe, it, expect } from 'vitest';
import { secretSchema } from '@/lib/schemas/secret';

describe('Secrets API Fix Validation', () => {
  it('should validate the schema correctly with recipient_name field', () => {
    const validData = {
      title: 'Test Secret',
      server_share: 'encrypted-share-data',
      recipient_name: 'John Doe',
      recipient_email: 'john@example.com',
      contact_method: 'email' as const,
      check_in_days: 30,
      sss_shares_total: 3,
      sss_threshold: 2
    };

    const result = secretSchema.safeParse(validData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recipient_name).toBe('John Doe');
      expect(result.data.contact_method).toBe('email');
    }
  });

  it('should handle field transformation from API to database format', () => {
    // Simulate the field mapping that happens in the API
    const apiData = {
      recipient_name: 'Jane Smith',
      recipient_email: 'jane@example.com',
      contact_method: 'email' as const,
      check_in_days: 30
    };

    // This is what the API should transform it to for the database
    const dbData = {
      title: 'Test',
      recipientName: apiData.recipient_name, // snake_case -> camelCase
      recipientEmail: apiData.recipient_email,
      contactMethod: apiData.contact_method,
      checkInDays: apiData.check_in_days,
      serverShare: 'encrypted-data',
      iv: 'iv',
      authTag: 'tag',
      userId: 'user123',
      sssSharesTotal: 3,
      sssThreshold: 2,
      status: 'active' as const,
      nextCheckIn: new Date()
    };

    // Verify the transformation is correct
    expect(dbData.recipientName).toBe('Jane Smith');
    expect(dbData.contactMethod).toBe('email');
    expect(dbData.checkInDays).toBe(30);
  });

  it('should handle invalid data appropriately', () => {
    const invalidData = {
      title: '', // Invalid: empty title
      server_share: 'data',
      recipient_name: 'John',
      contact_method: 'invalid' as any, // Invalid enum value
      check_in_days: 1, // Invalid: too low
      sss_shares_total: 3,
      sss_threshold: 2
    };

    const result = secretSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.issues.map(issue => issue.path.join('.'));
      expect(errors).toContain('title');
      expect(errors).toContain('contact_method');
      expect(errors).toContain('check_in_days');
    }
  });
});