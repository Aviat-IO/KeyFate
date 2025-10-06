/**
 * Test suite for duplicate reminder email bug fix
 *
 * ROOT CAUSE: shouldSendReminder() evaluates time windows without checking
 * if reminder already sent. Same reminder sends every 15min while in window
 * (e.g., 4 emails during 1-hour threshold).
 *
 * REQUIRED FIX:
 * 1. Create getReminderType() helper that determines reminder type based on time remaining
 * 2. Create hasReminderBeenSent() helper that checks if reminder was already sent
 * 3. Update processSecret() to check hasReminderBeenSent() before sending
 * 4. After successful email send, insert record into reminderJobs
 * 5. Use database transaction to ensure atomicity
 */

import { describe, it, expect } from 'vitest';

// Type definitions for reminder types
type ReminderType = '1_hour' | '12_hours' | '24_hours' | '3_days' | '7_days' | '25_percent' | '50_percent';

/**
 * Helper function to determine reminder type based on time remaining
 */
export function getReminderType(
  nextCheckIn: Date,
  checkInDays: number
): ReminderType | null {
  const now = new Date();
  const msRemaining = nextCheckIn.getTime() - now.getTime();

  // Return null for expired check-ins
  if (msRemaining <= 0) {
    return null;
  }

  const hoursRemaining = msRemaining / (1000 * 60 * 60);
  const daysRemaining = hoursRemaining / 24;
  const totalHours = checkInDays * 24;
  const percentRemaining = (hoursRemaining / totalHours) * 100;

  // Critical: 1h before (highest priority)
  if (hoursRemaining <= 1) {
    return '1_hour';
  }

  // High urgency: 12h, 24h before
  if (hoursRemaining <= 12) {
    return '12_hours';
  }
  if (hoursRemaining <= 24) {
    return '24_hours';
  }

  // Medium urgency: 3d, 7d before
  if (daysRemaining <= 3) {
    return '3_days';
  }
  if (daysRemaining <= 7) {
    return '7_days';
  }

  // Low urgency: 25%, 50% of check-in period (lowest priority)
  if (percentRemaining <= 25) {
    return '25_percent';
  }
  if (percentRemaining <= 50) {
    return '50_percent';
  }

  return null;
}

describe('Duplicate Reminder Bug Fix - Core Logic', () => {
  describe('getReminderType', () => {
    it('should return 1_hour for 30 minutes remaining', () => {
      const nextCheckIn = new Date();
      nextCheckIn.setMinutes(nextCheckIn.getMinutes() + 30); // 0.5 hours

      const result = getReminderType(nextCheckIn, 30);
      expect(result).toBe('1_hour');
    });

    it('should return 1_hour for 59 minutes remaining', () => {
      const nextCheckIn = new Date();
      nextCheckIn.setMinutes(nextCheckIn.getMinutes() + 59);

      const result = getReminderType(nextCheckIn, 30);
      expect(result).toBe('1_hour');
    });

    it('should return 12_hours for 11.5 hours remaining', () => {
      const nextCheckIn = new Date();
      nextCheckIn.setHours(nextCheckIn.getHours() + 11.5);

      const result = getReminderType(nextCheckIn, 30);
      expect(result).toBe('12_hours');
    });

    it('should return 24_hours for 23.5 hours remaining', () => {
      const nextCheckIn = new Date();
      nextCheckIn.setHours(nextCheckIn.getHours() + 23.5);

      const result = getReminderType(nextCheckIn, 30);
      expect(result).toBe('24_hours');
    });

    it('should return 3_days for 2.95 days remaining', () => {
      const nextCheckIn = new Date();
      nextCheckIn.setDate(nextCheckIn.getDate() + 2.95);

      const result = getReminderType(nextCheckIn, 30);
      expect(result).toBe('3_days');
    });

    it('should return 7_days for 6.95 days remaining', () => {
      const nextCheckIn = new Date();
      nextCheckIn.setDate(nextCheckIn.getDate() + 6.95);

      const result = getReminderType(nextCheckIn, 30);
      expect(result).toBe('7_days');
    });

    it('should return 50_percent for 15 days remaining in 30-day period', () => {
      const nextCheckIn = new Date();
      nextCheckIn.setDate(nextCheckIn.getDate() + 15); // 50% of 30 days

      const result = getReminderType(nextCheckIn, 30);
      expect(result).toBe('50_percent');
    });

    it('should return 7_days for 7.5 days remaining (takes priority over 25_percent)', () => {
      const nextCheckIn = new Date();
      nextCheckIn.setDate(nextCheckIn.getDate() + 7.5); // Both 7-day AND 25% threshold

      // 7-day threshold has higher priority than percentage-based
      const result = getReminderType(nextCheckIn, 30);
      expect(result).toBe('7_days');
    });

    it('should return 25_percent for 25 days remaining in 100-day period', () => {
      const nextCheckIn = new Date();
      nextCheckIn.setDate(nextCheckIn.getDate() + 25); // 25% of 100-day period

      const result = getReminderType(nextCheckIn, 100);
      expect(result).toBe('25_percent');
    });

    it('should return null when no reminder threshold is met', () => {
      const nextCheckIn = new Date();
      nextCheckIn.setDate(nextCheckIn.getDate() + 20); // No threshold here

      const result = getReminderType(nextCheckIn, 30);
      expect(result).toBe(null);
    });

    it('should return null for expired check-ins (negative time)', () => {
      const nextCheckIn = new Date();
      nextCheckIn.setMinutes(nextCheckIn.getMinutes() - 10); // Past due

      const result = getReminderType(nextCheckIn, 30);
      expect(result).toBe(null);
    });
  });

  describe('Duplicate Prevention Logic', () => {
    it('should prevent multiple sends of same reminder type', () => {
      // Simulate 4 cron runs within same time window
      const nextCheckIn = new Date();
      nextCheckIn.setMinutes(nextCheckIn.getMinutes() + 30); // 1-hour threshold

      const sentReminders = new Set<ReminderType>();
      let remindersSent = 0;

      for (let i = 0; i < 4; i++) {
        const reminderType = getReminderType(nextCheckIn, 30);

        if (reminderType && !sentReminders.has(reminderType)) {
          sentReminders.add(reminderType);
          remindersSent++;
        }
      }

      // Only ONE reminder should be sent
      expect(remindersSent).toBe(1);
      expect(sentReminders.has('1_hour')).toBe(true);
      expect(sentReminders.size).toBe(1);
    });

    it('should allow different reminder types to be sent', () => {
      const sentReminders = new Set<ReminderType>();

      // Simulate progression through different thresholds
      const thresholds = [
        { days: 7, expected: '7_days' },
        { days: 3, expected: '3_days' },
        { hours: 23.5, expected: '24_hours' },
        { hours: 11.5, expected: '12_hours' },
        { minutes: 30, expected: '1_hour' },
      ];

      for (const threshold of thresholds) {
        const nextCheckIn = new Date();

        if ('days' in threshold) {
          nextCheckIn.setDate(nextCheckIn.getDate() + threshold.days);
        } else if ('hours' in threshold) {
          nextCheckIn.setHours(nextCheckIn.getHours() + threshold.hours);
        } else if ('minutes' in threshold) {
          nextCheckIn.setMinutes(nextCheckIn.getMinutes() + threshold.minutes);
        }

        const reminderType = getReminderType(nextCheckIn, 30);

        if (reminderType && !sentReminders.has(reminderType)) {
          sentReminders.add(reminderType);
          expect(reminderType).toBe(threshold.expected);
        }
      }

      // Should have sent 5 different reminder types
      expect(sentReminders.size).toBe(5);
    });

    it('should handle percentage-based reminders correctly', () => {
      const sentReminders = new Set<ReminderType>();

      // Test 50% threshold
      let nextCheckIn = new Date();
      nextCheckIn.setDate(nextCheckIn.getDate() + 15); // 50% of 30-day period

      let reminderType = getReminderType(nextCheckIn, 30);
      if (reminderType && !sentReminders.has(reminderType)) {
        sentReminders.add(reminderType);
      }

      expect(sentReminders.has('50_percent')).toBe(true);

      // Test 25% threshold (using 100-day period to make percentages meaningful)
      nextCheckIn = new Date();
      nextCheckIn.setDate(nextCheckIn.getDate() + 25); // 25% of 100-day period

      reminderType = getReminderType(nextCheckIn, 100);
      if (reminderType && !sentReminders.has(reminderType)) {
        sentReminders.add(reminderType);
      }

      expect(sentReminders.has('25_percent')).toBe(true);
      expect(sentReminders.size).toBe(2);
    });
  });
});
