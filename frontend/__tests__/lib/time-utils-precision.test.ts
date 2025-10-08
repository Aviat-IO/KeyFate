/**
 * Tests for floating point precision handling in formatTimeRemaining
 */

import { describe, it, expect } from 'vitest';
import { formatTimeRemaining } from '@/lib/time-utils';

describe('formatTimeRemaining - Floating Point Precision', () => {
  describe('Handles floating point precision issues', () => {
    it('should handle 54/1440 days correctly (floating point precision)', () => {
      // 54/1440 = 0.0375 which causes 53.99999... minutes
      const result = formatTimeRemaining(54 / 1440);
      // After rounding, should correctly display 54 minutes
      expect(result).toBe('54 minutes');
    });

    it('should handle 0.9/24 days correctly (0.9 hours)', () => {
      // 0.9/24 causes floating point precision issues
      const result = formatTimeRemaining(0.9 / 24);
      // After rounding, should correctly display 54 minutes
      expect(result).toBe('54 minutes');
    });

    it('should handle 1/24 days correctly (exactly 1 hour)', () => {
      const result = formatTimeRemaining(1 / 24);
      expect(result).toBe('1 hour');
    });

    it('should handle very long decimal numbers', () => {
      // Simulate database returning long decimal
      const result = formatTimeRemaining(0.0416666666666666666666);
      expect(result).toBe('1 hour'); // Should round to 1.0 hours
    });

    it('should handle multiple division operations', () => {
      // Common calculation: hours / 24 / 60
      const hoursRemaining = 2.5;
      const daysFromHours = hoursRemaining / 24;
      const result = formatTimeRemaining(daysFromHours);
      expect(result).toBe('2 hours');
    });

    it('should handle edge case near boundaries', () => {
      // Just barely over 1 hour (1.0000001 hours)
      const result1 = formatTimeRemaining((1.0000001) / 24);
      expect(result1).toBe('1 hour'); // Floor to 1 hour
      
      // Just barely under 1 hour (0.9999999 hours) - threshold treats as 1 hour
      const result2 = formatTimeRemaining((0.9999999) / 24);
      expect(result2).toBe('1 hour'); // Within threshold of 1 hour
    });

    it('should handle database-style calculations', () => {
      // Simulate: (nextCheckIn - now) / (1000 * 60 * 60 * 24)
      const msRemaining = 3600000; // 1 hour in milliseconds
      const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
      const result = formatTimeRemaining(daysRemaining);
      expect(result).toBe('1 hour');
    });

    it('should handle very small fractional values', () => {
      // 0.5 minutes = 0.5/1440 days
      const result = formatTimeRemaining(0.5 / 1440);
      expect(result).toBe('less than a minute');
    });

    it('should handle negative values gracefully', () => {
      const result = formatTimeRemaining(-0.5);
      expect(result).toBe('less than a minute');
    });
  });

  describe('Maintains correct rounding behavior', () => {
    it('should floor hours for urgency even with rounding', () => {
      // 5.9999999 hours - within threshold, treated as 6 hours, floored to 6
      const result = formatTimeRemaining((5.9999999) / 24);
      expect(result).toBe('6 hours'); // Threshold rounds to 6
    });

    it('should floor days for urgency even with rounding', () => {
      // 7.9999999 days - within threshold, treated as 8 days, floored to 8
      const result = formatTimeRemaining(7.9999999);
      expect(result).toBe('8 days'); // Threshold rounds to 8
    });

    it('should floor minutes for urgency even with rounding', () => {
      // 30.9999999 minutes - within threshold, treated as 31 minutes, floored to 31
      const result = formatTimeRemaining((30.9999999 / 60) / 24);
      expect(result).toBe('31 minutes'); // Threshold rounds to 31
    });
  });

  describe('Real-world database scenarios', () => {
    it('should handle time from PostgreSQL timestamp calculations', () => {
      // PostgreSQL might return: EXTRACT(EPOCH FROM (next_check_in - NOW())) / 86400
      const result1 = formatTimeRemaining(0.041666666666667); // ~1 hour
      expect(result1).toBe('1 hour');

      const result2 = formatTimeRemaining(0.020833333333334); // ~30 minutes (more precision)
      expect(result2).toBe('30 minutes');
    });

    it('should handle varied precision from different DB systems', () => {
      // Some DBs return different precision
      const variations = [
        0.0375,           // Standard
        0.037500000000,   // Extra zeros
        0.0374999999999,  // Slightly under
        0.0375000000001,  // Slightly over
      ];

      variations.forEach(value => {
        const result = formatTimeRemaining(value);
        // All should normalize to 54 minutes (0.9 hours)
        expect(result).toBe('54 minutes');
      });
    });

    it('should handle millisecond-to-day conversions', () => {
      // Common pattern: milliseconds / (1000 * 60 * 60 * 24)
      const testCases = [
        { ms: 86400000, expected: '1 day' },        // 1 day
        { ms: 3600000, expected: '1 hour' },        // 1 hour
        { ms: 1800000, expected: '30 minutes' },    // 30 minutes
        { ms: 60000, expected: '1 minute' },        // 1 minute
        { ms: 30000, expected: 'less than a minute' }, // 30 seconds
      ];

      testCases.forEach(({ ms, expected }) => {
        const days = ms / (1000 * 60 * 60 * 24);
        const result = formatTimeRemaining(days);
        // For debugging
        if (result !== expected) {
          console.log(`ms: ${ms}, days: ${days}, result: ${result}, expected: ${expected}`);
        }
        expect(result).toBe(expected);
      });
    });
  });
});
