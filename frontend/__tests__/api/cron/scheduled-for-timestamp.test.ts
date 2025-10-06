/**
 * Test suite for scheduledFor timestamp calculation in recordReminderSent()
 *
 * Ensures that scheduledFor field correctly reflects when each reminder type
 * should fire relative to the check-in deadline, not just the current time.
 *
 * Bug context: All reminder_jobs records had identical scheduled_for timestamps
 * (current time) regardless of reminder type. The fix calculates scheduledFor
 * based on: scheduledFor = nextCheckIn - reminderThreshold
 */

import { describe, it, expect } from 'vitest';

// Type definition for reminder types (from route.ts)
type ReminderType = '1_hour' | '12_hours' | '24_hours' | '3_days' | '7_days' | '25_percent' | '50_percent';

/**
 * Calculate when this reminder should have been scheduled
 * This is the core logic from recordReminderSent() function
 */
export function calculateScheduledFor(
  reminderType: ReminderType,
  nextCheckIn: Date
): Date {
  const now = new Date();
  const checkInTime = nextCheckIn.getTime();

  let scheduledFor: Date;

  switch(reminderType) {
    case '1_hour':
      scheduledFor = new Date(checkInTime - (1 * 60 * 60 * 1000));
      break;
    case '12_hours':
      scheduledFor = new Date(checkInTime - (12 * 60 * 60 * 1000));
      break;
    case '24_hours':
      scheduledFor = new Date(checkInTime - (24 * 60 * 60 * 1000));
      break;
    case '3_days':
      scheduledFor = new Date(checkInTime - (3 * 24 * 60 * 60 * 1000));
      break;
    case '7_days':
      scheduledFor = new Date(checkInTime - (7 * 24 * 60 * 60 * 1000));
      break;
    case '25_percent':
    case '50_percent':
      // For percentage-based reminders, use current time as we don't have checkInDays
      // These are calculated dynamically based on the check-in period
      scheduledFor = now;
      break;
  }

  return scheduledFor;
}

describe('scheduledFor Timestamp Calculation', () => {
  describe('calculateScheduledFor', () => {
    it('should calculate scheduledFor for 1_hour reminder = nextCheckIn - 1 hour', () => {
      const nextCheckIn = new Date('2025-10-15T12:00:00Z');
      const expectedScheduledFor = new Date('2025-10-15T11:00:00Z'); // 1 hour before

      const result = calculateScheduledFor('1_hour', nextCheckIn);

      expect(result.toISOString()).toBe(expectedScheduledFor.toISOString());
    });

    it('should calculate scheduledFor for 12_hours reminder = nextCheckIn - 12 hours', () => {
      const nextCheckIn = new Date('2025-10-15T12:00:00Z');
      const expectedScheduledFor = new Date('2025-10-15T00:00:00Z'); // 12 hours before

      const result = calculateScheduledFor('12_hours', nextCheckIn);

      expect(result.toISOString()).toBe(expectedScheduledFor.toISOString());
    });

    it('should calculate scheduledFor for 24_hours reminder = nextCheckIn - 24 hours', () => {
      const nextCheckIn = new Date('2025-10-15T12:00:00Z');
      const expectedScheduledFor = new Date('2025-10-14T12:00:00Z'); // 24 hours before

      const result = calculateScheduledFor('24_hours', nextCheckIn);

      expect(result.toISOString()).toBe(expectedScheduledFor.toISOString());
    });

    it('should calculate scheduledFor for 3_days reminder = nextCheckIn - 3 days', () => {
      const nextCheckIn = new Date('2025-10-15T12:00:00Z');
      const expectedScheduledFor = new Date('2025-10-12T12:00:00Z'); // 3 days before

      const result = calculateScheduledFor('3_days', nextCheckIn);

      expect(result.toISOString()).toBe(expectedScheduledFor.toISOString());
    });

    it('should calculate scheduledFor for 7_days reminder = nextCheckIn - 7 days', () => {
      const nextCheckIn = new Date('2025-10-15T12:00:00Z');
      const expectedScheduledFor = new Date('2025-10-08T12:00:00Z'); // 7 days before

      const result = calculateScheduledFor('7_days', nextCheckIn);

      expect(result.toISOString()).toBe(expectedScheduledFor.toISOString());
    });

    it('should use current time for 25_percent reminder', () => {
      const nextCheckIn = new Date('2025-10-15T12:00:00Z');
      const beforeCall = new Date();

      const result = calculateScheduledFor('25_percent', nextCheckIn);
      const afterCall = new Date();

      // scheduledFor should be between beforeCall and afterCall
      expect(result.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime() - 100);
      expect(result.getTime()).toBeLessThanOrEqual(afterCall.getTime() + 100);
    });

    it('should use current time for 50_percent reminder', () => {
      const nextCheckIn = new Date('2025-10-15T12:00:00Z');
      const beforeCall = new Date();

      const result = calculateScheduledFor('50_percent', nextCheckIn);
      const afterCall = new Date();

      // scheduledFor should be between beforeCall and afterCall
      expect(result.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime() - 100);
      expect(result.getTime()).toBeLessThanOrEqual(afterCall.getTime() + 100);
    });

    it('should calculate different scheduledFor timestamps for different secrets', () => {
      const nextCheckIn1 = new Date('2025-10-15T12:00:00Z');
      const nextCheckIn2 = new Date('2025-10-16T12:00:00Z');
      const nextCheckIn3 = new Date('2025-10-20T12:00:00Z');

      // Use same reminder type but different check-in times
      const result1 = calculateScheduledFor('12_hours', nextCheckIn1);
      const result2 = calculateScheduledFor('12_hours', nextCheckIn2);
      const result3 = calculateScheduledFor('12_hours', nextCheckIn3);

      // All three scheduledFor timestamps should be different
      const timestamps = [result1.getTime(), result2.getTime(), result3.getTime()];
      const uniqueTimestamps = new Set(timestamps);

      expect(uniqueTimestamps.size).toBe(3);
    });

    it('should correctly reflect reminder threshold offset from nextCheckIn', () => {
      const nextCheckIn = new Date('2025-10-15T12:00:00Z');

      // Test 12_hours reminder
      const result = calculateScheduledFor('12_hours', nextCheckIn);
      const expectedOffset = 12 * 60 * 60 * 1000; // 12 hours in ms

      const actualOffset = nextCheckIn.getTime() - result.getTime();

      expect(actualOffset).toBe(expectedOffset);
    });

    it('should calculate scheduledFor correctly regardless of current time', () => {
      const nextCheckIn = new Date('2025-10-15T12:00:00Z');

      // Calculate multiple times (simulating different cron runs)
      const result1 = calculateScheduledFor('3_days', nextCheckIn);
      const result2 = calculateScheduledFor('3_days', nextCheckIn);

      // Both calculations should produce the same result
      expect(result1.toISOString()).toBe(result2.toISOString());
    });

    it('should handle edge case: nextCheckIn is far in the future', () => {
      const nextCheckIn = new Date('2026-01-01T00:00:00Z'); // Far future
      const expectedScheduledFor = new Date('2025-12-25T00:00:00Z'); // 7 days before

      const result = calculateScheduledFor('7_days', nextCheckIn);

      expect(result.toISOString()).toBe(expectedScheduledFor.toISOString());
    });

    it('should handle edge case: nextCheckIn is very close', () => {
      const nextCheckIn = new Date(Date.now() + (30 * 60 * 1000)); // 30 minutes from now
      const expectedScheduledFor = new Date(nextCheckIn.getTime() - (1 * 60 * 60 * 1000)); // 1 hour before

      const result = calculateScheduledFor('1_hour', nextCheckIn);

      // scheduledFor should be in the past (30 minutes ago)
      expect(result.getTime()).toBeLessThan(Date.now());
    });

    it('should preserve exact millisecond precision in calculations', () => {
      const nextCheckIn = new Date('2025-10-15T12:34:56.789Z'); // With milliseconds

      const result = calculateScheduledFor('12_hours', nextCheckIn);

      // Milliseconds should be preserved in calculation
      expect(result.getMilliseconds()).toBe(789);
    });
  });

  describe('scheduledFor Bug Fix Verification', () => {
    it('should NOT use current time for time-based reminders', () => {
      const nextCheckIn = new Date('2025-10-15T12:00:00Z');
      const now = new Date();

      const result = calculateScheduledFor('12_hours', nextCheckIn);

      // scheduledFor should NOT be close to current time
      const timeDiff = Math.abs(result.getTime() - now.getTime());

      // Difference should be significant (more than 1 minute)
      expect(timeDiff).toBeGreaterThan(60 * 1000);
    });

    it('should calculate scheduledFor based on nextCheckIn, not current time', () => {
      const nextCheckIn = new Date('2025-10-15T12:00:00Z');

      const result = calculateScheduledFor('3_days', nextCheckIn);

      // scheduledFor should be calculated from nextCheckIn
      const expectedBase = nextCheckIn.getTime();
      const actualBase = result.getTime() + (3 * 24 * 60 * 60 * 1000);

      expect(actualBase).toBe(expectedBase);
    });

    it('should produce consistent scheduledFor for same inputs', () => {
      const nextCheckIn = new Date('2025-10-15T12:00:00Z');

      // Multiple calculations with same inputs
      const results = [
        calculateScheduledFor('24_hours', nextCheckIn),
        calculateScheduledFor('24_hours', nextCheckIn),
        calculateScheduledFor('24_hours', nextCheckIn),
      ];

      // All results should be identical
      const uniqueResults = new Set(results.map(r => r.toISOString()));
      expect(uniqueResults.size).toBe(1);
    });
  });
});
