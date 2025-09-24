/**
 * TDD Test Suite: Dashboard Hanging Fix Validation
 *
 * This test suite validates that the dashboard hanging issue has been fixed
 * using the new DashboardService with timeout protection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DashboardService, DashboardTimeoutError, withTimeout } from '@/lib/dashboard/dashboard-service';
import { getServerSession } from 'next-auth/next';
import { secretsService } from '@/lib/db/drizzle';

// Mock next-auth
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

// Mock secrets service
vi.mock('@/lib/db/drizzle', () => ({
  secretsService: {
    getAllByUser: vi.fn(),
  },
}));

// Mock auth config
vi.mock('@/lib/auth-config', () => ({
  authConfig: {
    providers: [],
    callbacks: {},
  },
}));

describe('Dashboard Hanging Fix Validation', () => {
  const mockSession = {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
    },
  };

  const mockSecrets = [
    { id: '1', title: 'Test Secret 1', userId: 'test-user-id' },
    { id: '2', title: 'Test Secret 2', userId: 'test-user-id' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    DashboardService.clearCaches();
    console.log = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GREEN PHASE - Verify Fixes Work', () => {
    it('should handle normal session loading without timeout', async () => {
      // Test: Normal session loading should work quickly
      const mockGetServerSession = vi.mocked(getServerSession);
      mockGetServerSession.mockResolvedValue(mockSession);

      const startTime = Date.now();
      const session = await DashboardService.getSession();
      const elapsed = Date.now() - startTime;

      expect(session).toEqual(mockSession);
      expect(elapsed).toBeLessThan(100); // Should be very fast
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });

    it('should handle normal secrets loading without timeout', async () => {
      // Test: Normal secrets loading should work quickly
      const mockSecretsService = vi.mocked(secretsService.getAllByUser);
      mockSecretsService.mockResolvedValue(mockSecrets as any);

      const startTime = Date.now();
      const secrets = await DashboardService.getUserSecrets('test-user-id');
      const elapsed = Date.now() - startTime;

      expect(secrets).toEqual(mockSecrets);
      expect(elapsed).toBeLessThan(100); // Should be very fast
      expect(mockSecretsService).toHaveBeenCalledWith('test-user-id');
    });

    it('should timeout hanging session operations', async () => {
      // Test: Hanging session operations should timeout properly
      const mockGetServerSession = vi.mocked(getServerSession);

      // Simulate hanging session
      mockGetServerSession.mockImplementation(() => {
        return new Promise(() => {
          // Never resolves
        });
      });

      const startTime = Date.now();

      await expect(DashboardService.getSession()).rejects.toThrow(DashboardTimeoutError);

      const elapsed = Date.now() - startTime;
      // Should timeout in ~3 seconds (as configured in DashboardService)
      expect(elapsed).toBeGreaterThanOrEqual(2900);
      expect(elapsed).toBeLessThan(3500);
    });

    it('should timeout hanging secrets operations', async () => {
      // Test: Hanging secrets operations should timeout properly
      const mockSecretsService = vi.mocked(secretsService.getAllByUser);

      // Simulate hanging secrets query
      mockSecretsService.mockImplementation(() => {
        return new Promise(() => {
          // Never resolves
        });
      });

      const startTime = Date.now();

      await expect(DashboardService.getUserSecrets('test-user-id')).rejects.toThrow(DashboardTimeoutError);

      const elapsed = Date.now() - startTime;
      // Should timeout in ~5 seconds (as configured in DashboardService)
      expect(elapsed).toBeGreaterThanOrEqual(4900);
      expect(elapsed).toBeLessThan(5500);
    });

    it('should handle complete dashboard data loading without hanging', async () => {
      // Test: Complete dashboard flow should work without hanging
      const mockGetServerSession = vi.mocked(getServerSession);
      const mockSecretsService = vi.mocked(secretsService.getAllByUser);

      mockGetServerSession.mockResolvedValue(mockSession);
      mockSecretsService.mockResolvedValue(mockSecrets as any);

      const startTime = Date.now();
      const result = await DashboardService.loadDashboardData();
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data?.user).toEqual(mockSession.user);
      expect(result.data?.secrets).toEqual(mockSecrets);
      expect(elapsed).toBeLessThan(200); // Should complete quickly
    });

    it('should handle dashboard data loading with hanging database gracefully', async () => {
      // Test: Dashboard should handle hanging database operations gracefully
      const mockGetServerSession = vi.mocked(getServerSession);
      const mockSecretsService = vi.mocked(secretsService.getAllByUser);

      mockGetServerSession.mockResolvedValue(mockSession);

      // Simulate hanging database
      mockSecretsService.mockImplementation(() => {
        return new Promise(() => {
          // Never resolves
        });
      });

      const startTime = Date.now();
      const result = await DashboardService.loadDashboardData();
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.error).toBe('TIMEOUT');
      expect(result.message).toContain('timed out');
      // Should timeout gracefully in ~5 seconds
      expect(elapsed).toBeGreaterThanOrEqual(4900);
      expect(elapsed).toBeLessThan(6000);
    });

    it('should cache session to prevent multiple calls', async () => {
      // Test: Session caching should prevent hanging from multiple calls
      const mockGetServerSession = vi.mocked(getServerSession);
      mockGetServerSession.mockResolvedValue(mockSession);

      // Make multiple session calls
      const [session1, session2, session3] = await Promise.all([
        DashboardService.getSession(),
        DashboardService.getSession(),
        DashboardService.getSession(),
      ]);

      expect(session1).toEqual(mockSession);
      expect(session2).toEqual(mockSession);
      expect(session3).toEqual(mockSession);

      // Should only call getServerSession once due to caching
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });

    it('should handle database connection errors gracefully', async () => {
      // Test: Database connection errors should be handled gracefully
      const mockGetServerSession = vi.mocked(getServerSession);
      const mockSecretsService = vi.mocked(secretsService.getAllByUser);

      mockGetServerSession.mockResolvedValue(mockSession);
      mockSecretsService.mockRejectedValue(new Error('Database connection failed'));

      const result = await DashboardService.loadDashboardData();

      expect(result.success).toBe(false);
      expect(result.error).toBe('UNKNOWN');
      expect(result.message).toContain('unexpected error');
    });

    it('should handle no session gracefully', async () => {
      // Test: No session should be handled gracefully
      const mockGetServerSession = vi.mocked(getServerSession);
      mockGetServerSession.mockResolvedValue(null);

      const result = await DashboardService.loadDashboardData();

      expect(result.success).toBe(false);
      expect(result.error).toBe('NO_SESSION');
      expect(result.message).toBe('Please sign in to continue');
    });
  });

  describe('Timeout Utility Function Tests', () => {
    it('should allow normal promises to complete', async () => {
      // Test: Normal promises should complete without timeout
      const normalPromise = Promise.resolve('success');

      const result = await withTimeout(normalPromise, 1000, 'test-operation');

      expect(result).toBe('success');
    });

    it('should timeout hanging promises', async () => {
      // Test: Hanging promises should timeout
      const hangingPromise = new Promise(() => {
        // Never resolves
      });

      const startTime = Date.now();

      await expect(withTimeout(hangingPromise, 500, 'test-operation'))
        .rejects.toThrow(DashboardTimeoutError);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(450);
      expect(elapsed).toBeLessThan(600);
    });

    it('should pass through promise rejections', async () => {
      // Test: Promise rejections should be passed through
      const rejectingPromise = Promise.reject(new Error('Original error'));

      await expect(withTimeout(rejectingPromise, 1000, 'test-operation'))
        .rejects.toThrow('Original error');
    });
  });

  describe('Performance Regression Tests', () => {
    it('should maintain fast performance for normal operations', async () => {
      // Test: Normal operations should remain fast
      const mockGetServerSession = vi.mocked(getServerSession);
      const mockSecretsService = vi.mocked(secretsService.getAllByUser);

      mockGetServerSession.mockResolvedValue(mockSession);
      mockSecretsService.mockResolvedValue(mockSecrets as any);

      const iterations = 5;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        DashboardService.clearCaches(); // Clear cache for each iteration

        const startTime = Date.now();
        const result = await DashboardService.loadDashboardData();
        const elapsed = Date.now() - startTime;

        times.push(elapsed);
        expect(result.success).toBe(true);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log('Performance metrics:', { averageTime, maxTime, times });

      // Performance should be consistent
      expect(averageTime).toBeLessThan(100);
      expect(maxTime).toBeLessThan(200);
    });

    it('should handle concurrent requests efficiently', async () => {
      // Test: Concurrent requests should not block each other
      const mockGetServerSession = vi.mocked(getServerSession);
      const mockSecretsService = vi.mocked(secretsService.getAllByUser);

      mockGetServerSession.mockResolvedValue(mockSession);
      mockSecretsService.mockImplementation((userId) => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(mockSecrets as any), 100);
        });
      });

      const startTime = Date.now();

      // Make 3 concurrent requests
      const promises = [
        DashboardService.loadDashboardData(),
        DashboardService.loadDashboardData(),
        DashboardService.loadDashboardData(),
      ];

      const results = await Promise.all(promises);
      const elapsed = Date.now() - startTime;

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete in ~100ms due to session caching, not 300ms
      expect(elapsed).toBeLessThan(200);
    });
  });
});