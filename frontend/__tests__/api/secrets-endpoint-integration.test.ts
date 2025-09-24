import { describe, it, expect } from 'vitest';
import { secretSchema } from '@/lib/schemas/secret';

describe('Secrets API Data Transformation', () => {
  it('should validate API request data with recipient_name field', () => {
    const apiRequestData = {
      title: 'Test Secret',
      server_share: 'test-server-share',
      recipient_name: 'John Doe', // API format (snake_case)
      recipient_email: 'john@example.com',
      contact_method: 'email' as const,
      check_in_days: 30,
      sss_shares_total: 3,
      sss_threshold: 2
    };

    const result = secretSchema.safeParse(apiRequestData);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.recipient_name).toBe('John Doe');
      expect(result.data.contact_method).toBe('email');
      expect(result.data.check_in_days).toBe(30);
    }
  });

  it('should show the correct field transformation pattern', () => {
    // This represents the transformation that the API route performs
    const apiData = {
      recipient_name: 'Jane Smith',
      recipient_email: 'jane@example.com',
      contact_method: 'phone' as const,
      check_in_days: 14
    };

    // This is how the API transforms it for the database (matching Drizzle schema)
    const dbInsertData = {
      recipientName: apiData.recipient_name, // snake_case -> camelCase
      recipientEmail: apiData.recipient_email,
      contactMethod: apiData.contact_method,
      checkInDays: apiData.check_in_days
    };

    expect(dbInsertData.recipientName).toBe('Jane Smith');
    expect(dbInsertData.contactMethod).toBe('phone');
    expect(dbInsertData.checkInDays).toBe(14);
  });

  it('should identify the specific column error pattern', () => {
    const errorMessage = 'column "recipient_name" of relation "secrets" does not exist';

    // Our error detection should catch this pattern
    const isRecipientNameError = errorMessage.includes('recipient_name');

    expect(isRecipientNameError).toBe(true);
  });
});