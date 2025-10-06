/**
 * Integration test for email time display bug fix
 * Verifies that fractional days are converted to readable hours
 */

import { describe, it, expect } from 'vitest';
import { renderReminderTemplate } from '@/lib/email/templates';

describe('Email Time Display Bug Fix - Integration Test', () => {
  it('should fix the bug where fractional days show in email subject and body', () => {
    // This is the actual bug scenario: 0.039493980298572 days
    const buggyDaysRemaining = 0.039493980298572;

    const result = renderReminderTemplate({
      userName: 'Test User',
      secretTitle: 'Important Document',
      daysRemaining: buggyDaysRemaining,
      checkInUrl: 'https://example.com/check-in',
      urgencyLevel: 'critical',
    });

    // Before fix: "Check in required in 0.039493980298572 days"
    // After fix: "Check in required in 0 hours"

    // Verify subject line is readable
    expect(result.subject).toContain('0 hours');
    expect(result.subject).not.toContain('0.039493980298572');
    expect(result.subject).not.toContain(' days');

    // Verify HTML body is readable
    expect(result.html).toContain('0 hours');
    expect(result.html).not.toContain('0.039493980298572');

    // Verify plain text is readable
    expect(result.text).toContain('0 hours');
    expect(result.text).not.toContain('0.039493980298572');
  });

  it('should show hours for all fractional day values less than 1', () => {
    const fractionalDayValues = [
      { days: 0.001, expectedHours: 0 },  // Very small value
      { days: 0.04, expectedHours: 0 },   // ~1 hour
      { days: 0.083, expectedHours: 1 },  // ~2 hours, floors to 1
      { days: 0.25, expectedHours: 6 },   // 6 hours
      { days: 0.5, expectedHours: 12 },   // 12 hours
      { days: 0.75, expectedHours: 18 },  // 18 hours
      { days: 0.99, expectedHours: 23 },  // Almost 1 day
    ];

    fractionalDayValues.forEach(({ days, expectedHours }) => {
      const result = renderReminderTemplate({
        userName: 'Test User',
        secretTitle: 'Test Secret',
        daysRemaining: days,
        checkInUrl: 'https://example.com/check-in',
      });

      const hourText = expectedHours === 1 ? '1 hour' : `${expectedHours} hours`;
      expect(result.subject).toContain(hourText);
      expect(result.html).toContain(hourText);
    });
  });

  it('should show days for values >= 1 day', () => {
    const dayValues = [
      { days: 1.0, expected: '1 day' },
      { days: 1.9, expected: '1 day' },   // Floors to 1
      { days: 2.0, expected: '2 days' },
      { days: 7.5, expected: '7 days' },  // Floors to 7
      { days: 30, expected: '30 days' },
    ];

    dayValues.forEach(({ days, expected }) => {
      const result = renderReminderTemplate({
        userName: 'Test User',
        secretTitle: 'Test Secret',
        daysRemaining: days,
        checkInUrl: 'https://example.com/check-in',
      });

      expect(result.subject).toContain(expected);
      expect(result.html).toContain(expected);
    });
  });

  it('should show "today" for exactly 0 days', () => {
    const result = renderReminderTemplate({
      userName: 'Test User',
      secretTitle: 'Test Secret',
      daysRemaining: 0,
      checkInUrl: 'https://example.com/check-in',
      urgencyLevel: 'critical',
    });

    expect(result.subject).toContain('today');
    expect(result.html).toContain('today');
  });

  it('should format time consistently in subject, HTML, and text versions', () => {
    const testCases = [
      { days: 0.5, expected: '12 hours' },
      { days: 3.0, expected: '3 days' },
      { days: 0, expected: 'today' },
    ];

    testCases.forEach(({ days, expected }) => {
      const result = renderReminderTemplate({
        userName: 'Test User',
        secretTitle: 'Test Secret',
        daysRemaining: days,
        checkInUrl: 'https://example.com/check-in',
      });

      // All three formats should have the same time text
      expect(result.subject).toContain(expected);
      expect(result.html).toContain(expected);
      expect(result.text).toContain(expected);
    });
  });
});
