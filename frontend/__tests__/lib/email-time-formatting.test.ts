/**
 * Test for email time formatting fix
 * Ensures fractional days are displayed as hours
 */

import { describe, it, expect } from 'vitest';
import { renderReminderTemplate } from '@/lib/email/templates';

describe('Email Time Formatting', () => {
  const baseReminderData = {
    userName: 'John Doe',
    secretTitle: 'Test Secret',
    checkInUrl: 'https://example.com/check-in',
    urgencyLevel: 'medium' as const,
  };

  describe('formatTimeRemaining', () => {
    it('should format fractional days as hours when less than 1 day', () => {
      // Test case: 0.039493980298572 days = ~0.94 hours
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 0.039493980298572,
      });

      // Should show "0 hours" (floor of 0.94)
      expect(result.subject).toContain('0 hours');
      expect(result.subject).not.toContain('0.039493980298572');
      expect(result.html).toContain('0 hours');
      expect(result.text).toContain('0 hours');
    });

    it('should display 1 hour singular', () => {
      // 1.5 hours = 0.0625 days
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 0.0625,
      });

      expect(result.subject).toContain('1 hour');
      expect(result.subject).not.toContain('1 hours'); // Check singular
      expect(result.html).toContain('1 hour');
    });

    it('should display multiple hours plural', () => {
      // 12 hours = 0.5 days
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 0.5,
      });

      expect(result.subject).toContain('12 hours');
      expect(result.html).toContain('12 hours');
    });

    it('should round down hours', () => {
      // 5.9 hours = ~0.246 days
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 0.246,
      });

      // Should floor to 5 hours
      expect(result.subject).toContain('5 hours');
      expect(result.html).toContain('5 hours');
    });

    it('should display today when exactly 0 days', () => {
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 0,
      });

      expect(result.subject).toContain('today');
      expect(result.html).toContain('today');
    });

    it('should display 1 day singular when exactly 1 day', () => {
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 1,
      });

      expect(result.subject).toContain('1 day');
      expect(result.subject).not.toContain('1 days');
      expect(result.html).toContain('1 day');
    });

    it('should display 1 day for 1.x days (floor)', () => {
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 1.9,
      });

      expect(result.subject).toContain('1 day');
      expect(result.html).toContain('1 day');
    });

    it('should display multiple days plural', () => {
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 7,
      });

      expect(result.subject).toContain('7 days');
      expect(result.html).toContain('7 days');
    });

    it('should round down days', () => {
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 6.9,
      });

      // Should floor to 6 days
      expect(result.subject).toContain('6 days');
      expect(result.html).toContain('6 days');
    });

    it('should handle edge case of very small values', () => {
      // 0.001 days = 0.024 hours
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 0.001,
      });

      expect(result.subject).toContain('0 hours');
      expect(result.html).toContain('0 hours');
    });

    it('should handle edge case of transition from hours to days', () => {
      // 23 hours = 0.9583... days (should show hours)
      const result1 = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 23 / 24,
      });
      expect(result1.subject).toContain('23 hours');

      // 24 hours = 1 day exactly
      const result2 = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 1.0,
      });
      expect(result2.subject).toContain('1 day');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle 1 hour reminder correctly', () => {
      // 1 hour = 0.04166... days
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 1 / 24,
        urgencyLevel: 'critical',
      });

      expect(result.subject).toContain('1 hour');
      expect(result.subject).toContain('CRITICAL');
    });

    it('should handle 12 hour reminder correctly', () => {
      // 12 hours = 0.5 days
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 0.5,
        urgencyLevel: 'high',
      });

      expect(result.subject).toContain('12 hours');
      expect(result.subject).toContain('URGENT');
    });

    it('should handle 3 day reminder correctly', () => {
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 3,
        urgencyLevel: 'medium',
      });

      expect(result.subject).toContain('3 days');
      expect(result.subject).toContain('Important');
    });

    it('should handle 7 day reminder correctly', () => {
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 7,
        urgencyLevel: 'low',
      });

      expect(result.subject).toContain('7 days');
      expect(result.subject).toContain('Scheduled');
    });
  });
});
