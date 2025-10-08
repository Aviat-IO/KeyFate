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
    it('should format fractional days as minutes when less than 1 hour', () => {
      // Test case: 0.039493980298572 days = ~0.94 hours = ~56.55 minutes
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 0.039493980298572,
      });

      // Should show "56 minutes" (floor of 56.55)
      expect(result.subject).toContain('56 minutes');
      expect(result.subject).not.toContain('0.039493980298572');
      expect(result.html).toContain('56 minutes');
      expect(result.text).toContain('56 minutes');
    });

    it('should display 1 hour singular', () => {
      // 1 hour exactly = 1/24 days
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 1 / 24,
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

    it('should floor hours for urgency', () => {
      // 5.9 hours = ~0.246 days
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 0.246,
      });

      // Should floor to 5 hours (more urgent)
      expect(result.subject).toContain('5 hours');
      expect(result.html).toContain('5 hours');
    });

    it('should display minutes when less than 1 hour', () => {
      // 55 minutes
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 55 / 1440,
      });

      expect(result.subject).toContain('55 minutes');
      expect(result.html).toContain('55 minutes');
    });

    it('should display 1 minute singular', () => {
      // 1 minute = 1/1440 days
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 1 / 1440,
      });

      expect(result.subject).toContain('1 minute');
      expect(result.subject).not.toContain('1 minutes');
      expect(result.html).toContain('1 minute');
    });

    it('should display less than a minute when exactly 0 days', () => {
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 0,
      });

      expect(result.subject).toContain('less than a minute');
      expect(result.html).toContain('less than a minute');
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
      // 0.001 days = 0.024 hours = 1.44 minutes
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 0.001,
      });

      expect(result.subject).toContain('1 minute'); // floor(1.44) = 1
      expect(result.html).toContain('1 minute');
    });

    it('should handle edge case of transition from hours to days', () => {
      // 23 hours = 0.9583... days (should show hours)
      const result1 = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 23 / 24,
      });
      expect(result1.subject).toContain('23 hours'); // ceil(23) = 23

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

    it('should show minutes when reminder sent slightly before 1 hour deadline', () => {
      // Bug fix: When cron runs at ~55 minutes before deadline
      // it should display "55 minutes" not "0 hours"
      const result = renderReminderTemplate({
        ...baseReminderData,
        daysRemaining: 55 / 1440, // 55 minutes
        urgencyLevel: 'critical',
      });

      expect(result.subject).toContain('55 minutes');
      expect(result.subject).not.toContain('0 hours');
      expect(result.html).toContain('55 minutes');
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
