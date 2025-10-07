/**
 * Database Health Endpoint Tests
 *
 * TDD Test Suite for /api/health/database endpoint
 *
 * Test Coverage:
 * 1. Healthy database response (200)
 * 2. Unhealthy database response (503)
 * 3. Error handling (500)
 * 4. Response structure validation
 * 5. Performance metrics
 */

import { GET } from '@/app/api/health/database/route';
import { connectionManager } from '@/lib/db/connection-manager';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock connection manager
vi.mock('@/lib/db/connection-manager', () => ({
  connectionManager: {
    getStats: vi.fn(),
    healthCheck: vi.fn(),
  },
}));

describe('Database Health Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Healthy Database Response', () => {
    it('should return 200 status for healthy database', async () => {
      (connectionManager.getStats as any).mockReturnValue({
        connected: true,
        lastSuccessfulConnection: new Date('2025-10-07T02:00:00Z'),
        connectionAttempts: 0,
        circuitBreakerOpen: false,
        circuitBreakerResetTime: null,
      });

      (connectionManager.healthCheck as any).mockResolvedValue(true);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.database.connected).toBe(true);
      expect(data.health).toBeDefined();
      expect(data.health.querySuccessful).toBe(true);
    });

    it('should include timestamp in response', async () => {
      (connectionManager.getStats as any).mockReturnValue({
        connected: true,
        lastSuccessfulConnection: new Date(),
        connectionAttempts: 0,
        circuitBreakerOpen: false,
        circuitBreakerResetTime: null,
      });

      (connectionManager.healthCheck as any).mockResolvedValue(true);

      const response = await GET();
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });

    it('should include response time metrics', async () => {
      (connectionManager.getStats as any).mockReturnValue({
        connected: true,
        lastSuccessfulConnection: new Date(),
        connectionAttempts: 0,
        circuitBreakerOpen: false,
        circuitBreakerResetTime: null,
      });

      (connectionManager.healthCheck as any).mockResolvedValue(true);

      const response = await GET();
      const data = await response.json();

      expect(data.health?.responseTime).toBeDefined();
      expect(typeof data.health?.responseTime).toBe('number');
      expect(data.health?.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should include database connection statistics', async () => {
      const mockLastConnection = new Date('2025-10-07T02:00:00Z');

      (connectionManager.getStats as any).mockReturnValue({
        connected: true,
        lastSuccessfulConnection: mockLastConnection,
        connectionAttempts: 0,
        circuitBreakerOpen: false,
        circuitBreakerResetTime: null,
      });

      (connectionManager.healthCheck as any).mockResolvedValue(true);

      const response = await GET();
      const data = await response.json();

      expect(data.database).toEqual({
        connected: true,
        lastSuccessfulConnection: mockLastConnection.toISOString(),
        connectionAttempts: 0,
        circuitBreakerOpen: false,
        circuitBreakerResetTime: null,
      });
    });
  });

  describe('Unhealthy Database Response', () => {
    it('should return 503 status for unhealthy database', async () => {
      (connectionManager.getStats as any).mockReturnValue({
        connected: false,
        lastSuccessfulConnection: null,
        connectionAttempts: 3,
        circuitBreakerOpen: true,
        circuitBreakerResetTime: new Date('2025-10-07T02:30:00Z'),
      });

      (connectionManager.healthCheck as any).mockResolvedValue(false);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.database.connected).toBe(false);
    });

    it('should not include health metrics for unhealthy database', async () => {
      (connectionManager.getStats as any).mockReturnValue({
        connected: false,
        lastSuccessfulConnection: null,
        connectionAttempts: 0,
        circuitBreakerOpen: false,
        circuitBreakerResetTime: null,
      });

      (connectionManager.healthCheck as any).mockResolvedValue(false);

      const response = await GET();
      const data = await response.json();

      expect(data.health).toBeUndefined();
    });

    it('should show circuit breaker status when open', async () => {
      const resetTime = new Date('2025-10-07T03:00:00Z');

      (connectionManager.getStats as any).mockReturnValue({
        connected: false,
        lastSuccessfulConnection: null,
        connectionAttempts: 5,
        circuitBreakerOpen: true,
        circuitBreakerResetTime: resetTime,
      });

      (connectionManager.healthCheck as any).mockResolvedValue(false);

      const response = await GET();
      const data = await response.json();

      expect(data.database.circuitBreakerOpen).toBe(true);
      expect(data.database.circuitBreakerResetTime).toBe(resetTime.toISOString());
      expect(data.database.connectionAttempts).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 status on health check error', async () => {
      (connectionManager.getStats as any).mockReturnValue({
        connected: false,
        lastSuccessfulConnection: null,
        connectionAttempts: 0,
        circuitBreakerOpen: false,
        circuitBreakerResetTime: null,
      });

      (connectionManager.healthCheck as any).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.status).toBe('error');
      expect(data.error).toBe('Database connection failed');
    });

    it('should handle getStats errors gracefully', async () => {
      (connectionManager.getStats as any).mockImplementation(() => {
        throw new Error('Stats unavailable');
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.status).toBe('error');
      expect(data.error).toBeDefined();
    });

    it('should provide default error message when none available', async () => {
      (connectionManager.getStats as any).mockReturnValue({
        connected: false,
        lastSuccessfulConnection: null,
        connectionAttempts: 0,
        circuitBreakerOpen: false,
        circuitBreakerResetTime: null,
      });

      (connectionManager.healthCheck as any).mockRejectedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Health check failed');
    });
  });

  describe('Response Structure Validation', () => {
    it('should have correct response structure for healthy state', async () => {
      (connectionManager.getStats as any).mockReturnValue({
        connected: true,
        lastSuccessfulConnection: new Date(),
        connectionAttempts: 0,
        circuitBreakerOpen: false,
        circuitBreakerResetTime: null,
      });

      (connectionManager.healthCheck as any).mockResolvedValue(true);

      const response = await GET();
      const data = await response.json();

      expect(data).toMatchObject({
        status: expect.stringMatching(/^(healthy|unhealthy|error)$/),
        timestamp: expect.any(String),
        database: {
          connected: expect.any(Boolean),
          lastSuccessfulConnection: expect.any(String),
          connectionAttempts: expect.any(Number),
          circuitBreakerOpen: expect.any(Boolean),
          circuitBreakerResetTime: null,
        },
        health: {
          querySuccessful: expect.any(Boolean),
          responseTime: expect.any(Number),
        },
      });
    });

    it('should have correct response structure for unhealthy state', async () => {
      (connectionManager.getStats as any).mockReturnValue({
        connected: false,
        lastSuccessfulConnection: null,
        connectionAttempts: 2,
        circuitBreakerOpen: false,
        circuitBreakerResetTime: null,
      });

      (connectionManager.healthCheck as any).mockResolvedValue(false);

      const response = await GET();
      const data = await response.json();

      expect(data).toMatchObject({
        status: 'unhealthy',
        timestamp: expect.any(String),
        database: {
          connected: false,
          lastSuccessfulConnection: null,
          connectionAttempts: 2,
          circuitBreakerOpen: false,
          circuitBreakerResetTime: null,
        },
      });

      expect(data).not.toHaveProperty('health');
    });

    it('should have correct response structure for error state', async () => {
      (connectionManager.getStats as any).mockImplementation(() => {
        throw new Error('Critical error');
      });

      const response = await GET();
      const data = await response.json();

      expect(data).toMatchObject({
        status: 'error',
        timestamp: expect.any(String),
        database: {
          connected: false,
          lastSuccessfulConnection: null,
          connectionAttempts: 0,
          circuitBreakerOpen: false,
          circuitBreakerResetTime: null,
        },
        error: expect.any(String),
      });
    });
  });

  describe('Performance Metrics', () => {
    it('should measure health check response time accurately', async () => {
      (connectionManager.getStats as any).mockReturnValue({
        connected: true,
        lastSuccessfulConnection: new Date(),
        connectionAttempts: 0,
        circuitBreakerOpen: false,
        circuitBreakerResetTime: null,
      });

      // Simulate 50ms health check delay
      (connectionManager.healthCheck as any).mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve(true), 50))
      );

      const response = await GET();
      const data = await response.json();

      expect(data.health?.responseTime).toBeGreaterThanOrEqual(50);
      expect(data.health?.responseTime).toBeLessThan(1000); // Should be reasonably fast
    });

    it('should handle slow health checks', async () => {
      (connectionManager.getStats as any).mockReturnValue({
        connected: true,
        lastSuccessfulConnection: new Date(),
        connectionAttempts: 0,
        circuitBreakerOpen: false,
        circuitBreakerResetTime: null,
      });

      // Simulate 200ms slow health check
      (connectionManager.healthCheck as any).mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve(true), 200))
      );

      const response = await GET();
      const data = await response.json();

      expect(data.health?.responseTime).toBeGreaterThanOrEqual(200);
      expect(data.status).toBe('healthy');
    });
  });
});
