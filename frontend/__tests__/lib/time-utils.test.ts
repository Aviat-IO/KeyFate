/**
 * Tests for time-utils formatTimeRemaining function
 */

import { describe, it, expect } from 'vitest';
import { formatTimeRemaining } from '@/lib/time-utils';

describe('formatTimeRemaining', () => {
  describe('Days formatting', () => {
    it('should format whole days', () => {
      expect(formatTimeRemaining(7)).toBe('7 days');
      expect(formatTimeRemaining(3)).toBe('3 days');
      expect(formatTimeRemaining(2)).toBe('2 days');
    });

    it('should format 1 day singular', () => {
      expect(formatTimeRemaining(1)).toBe('1 day');
    });

    it('should floor fractional days >= 1', () => {
      expect(formatTimeRemaining(7.9)).toBe('7 days');
      expect(formatTimeRemaining(2.1)).toBe('2 days');
      expect(formatTimeRemaining(1.9)).toBe('1 day');
    });
  });

  describe('Hours formatting', () => {
    it('should format hours when >= 1 hour and < 1 day', () => {
      expect(formatTimeRemaining(0.5)).toBe('12 hours'); // 12 hours
      expect(formatTimeRemaining(5 / 24)).toBe('5 hours'); // 5 hours
      expect(formatTimeRemaining(23 / 24)).toBe('23 hours'); // 23 hours
    });

    it('should format 1 hour singular', () => {
      expect(formatTimeRemaining(1 / 24)).toBe('1 hour');
    });

    it('should floor fractional hours >= 1 for urgency', () => {
      expect(formatTimeRemaining(5.9 / 24)).toBe('5 hours'); // 5.9 hours -> 5 hours (floor)
      expect(formatTimeRemaining(1.1 / 24)).toBe('1 hour'); // 1.1 hours -> 1 hour (floor)
    });
  });

  describe('Minutes formatting', () => {
    it('should format minutes when < 1 hour', () => {
      // Use precise calculations to avoid floating point issues
      expect(formatTimeRemaining(55 / 1440)).toBe('55 minutes');
      expect(formatTimeRemaining(30 / 1440)).toBe('30 minutes');
      expect(formatTimeRemaining(45 / 1440)).toBe('45 minutes');
    });

    it('should format 1 minute singular', () => {
      expect(formatTimeRemaining(1 / 1440)).toBe('1 minute');
    });

    it('should floor fractional minutes for urgency', () => {
      expect(formatTimeRemaining(0.001)).toBe('1 minute'); // 1.44 minutes -> 1 minute (floor)
      expect(formatTimeRemaining(30.5 / 1440)).toBe('30 minutes'); // 30.5 minutes -> 30 minutes (floor)
    });

    it('should show less than a minute when very small', () => {
      expect(formatTimeRemaining(0.5 / 1440)).toBe('less than a minute'); // 0.5 minutes
      expect(formatTimeRemaining(0.0001)).toBe('less than a minute'); // ~0.14 minutes
    });
  });

  describe('Edge cases', () => {
    it('should handle exactly 0 days', () => {
      expect(formatTimeRemaining(0)).toBe('less than a minute');
    });

    it('should handle transition boundaries', () => {
      // Just under 1 hour (59.9 minutes)
      expect(formatTimeRemaining((59.9 / 60) / 24)).toBe('59 minutes'); // floor
      
      // Exactly 1 hour
      expect(formatTimeRemaining(1 / 24)).toBe('1 hour');
      
      // Just over 1 hour
      expect(formatTimeRemaining(1.01 / 24)).toBe('1 hour'); // floor
      
      // Just under 1 day (23.9 hours)
      expect(formatTimeRemaining(23.9 / 24)).toBe('23 hours'); // floor
      
      // Exactly 1 day
      expect(formatTimeRemaining(1)).toBe('1 day');
      
      // Just over 1 day
      expect(formatTimeRemaining(1.01)).toBe('1 day');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle common reminder thresholds', () => {
      expect(formatTimeRemaining(7)).toBe('7 days');
      expect(formatTimeRemaining(3)).toBe('3 days');
      expect(formatTimeRemaining(1)).toBe('1 day');
      expect(formatTimeRemaining(24 / 24)).toBe('1 day');
      expect(formatTimeRemaining(12 / 24)).toBe('12 hours');
      expect(formatTimeRemaining(1 / 24)).toBe('1 hour');
    });

    it('should handle the bug case: sub-hour times show as minutes', () => {
      // The original bug: this was showing "0 hours"
      // 55 minutes
      const result = formatTimeRemaining(55 / 1440);
      expect(result).toBe('55 minutes');
      expect(result).not.toContain('0 hours');
    });

    it('should handle cron timing variations with floor for urgency', () => {
      // Cron runs slightly before 1 hour threshold - show minutes
      expect(formatTimeRemaining(57 / 1440)).toBe('57 minutes'); // 57 minutes
      expect(formatTimeRemaining(59 / 1440)).toBe('59 minutes'); // 59 minutes
      
      // Cron runs at exactly 1 hour
      expect(formatTimeRemaining(1 / 24)).toBe('1 hour');
      
      // Cron runs slightly after 1 hour threshold - floor hours
      expect(formatTimeRemaining(1.05 / 24)).toBe('1 hour'); // floor(1.05)
      expect(formatTimeRemaining(1.9 / 24)).toBe('1 hour'); // floor(1.9)
    });

    it('should err on the side of urgency', () => {
      // With 5.9 hours left, show 5 hours (more urgent than 6)
      expect(formatTimeRemaining(5.9 / 24)).toBe('5 hours');
      
      // With 1.9 days left, show 1 day (more urgent than 2)
      expect(formatTimeRemaining(1.9)).toBe('1 day');
      
      // With 30.5 minutes left, show 30 minutes (more urgent than 31)
      expect(formatTimeRemaining(30.5 / 1440)).toBe('30 minutes');
    });
  });
});
