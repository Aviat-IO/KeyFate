/**
 * Database Connection Health Check Tests
 *
 * TDD Test Suite for Task 26: Implement Database Connection Health Checks
 *
 * Test Coverage:
 * 1. Connection health validation
 * 2. Connection pool monitoring
 * 3. Automatic reconnection logic
 * 4. Health endpoint functionality
 * 5. Connection timeout and retry mechanisms
 * 6. Simulated connection failures
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { connectionManager } from '@/lib/db/connection-manager';

// Mock postgres module
vi.mock('postgres', () => ({
  default: vi.fn()
}));

describe('Database Connection Health Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset connection manager state between tests
    connectionManager.reset();
  });

  afterEach(async () => {
    await connectionManager.closeConnection();
    connectionManager.reset();
  });

  describe('Connection Health Validation', () => {
    it('should successfully validate healthy database connection', async () => {
      const mockConnection = vi.fn().mockResolvedValue([{ health: 1 }]);
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';
      await connectionManager.getConnection(connectionString);

      const isHealthy = await connectionManager.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockConnection).toHaveBeenCalledWith(expect.arrayContaining([
        expect.stringContaining('SELECT 1 as health')
      ]));
    });

    it('should detect unhealthy connection when query fails', async () => {
      const mockConnection = vi.fn().mockRejectedValue(new Error('Connection lost'));
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';

      try {
        await connectionManager.getConnection(connectionString);
      } catch {
        // Connection will fail, that's expected
      }

      const isHealthy = await connectionManager.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should return false when no connection exists', async () => {
      const isHealthy = await connectionManager.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should validate connection before test runs', async () => {
      const mockConnection = vi.fn().mockResolvedValue([{ test: 1, db: 'test_db' }]);
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';
      const connection = await connectionManager.getConnection(connectionString);

      expect(connection).toBeDefined();
      expect(mockConnection).toHaveBeenCalled();
    });
  });

  describe('Connection Pool Monitoring', () => {
    it('should return connection pool statistics', () => {
      const stats = connectionManager.getStats();

      expect(stats).toHaveProperty('connected');
      expect(stats).toHaveProperty('lastSuccessfulConnection');
      expect(stats).toHaveProperty('connectionAttempts');
      expect(stats).toHaveProperty('circuitBreakerOpen');
      expect(stats).toHaveProperty('circuitBreakerResetTime');
    });

    it('should show connected state after successful connection', async () => {
      const mockConnection = vi.fn().mockResolvedValue([{ test: 1, db: 'test_db' }]);
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';
      await connectionManager.getConnection(connectionString);

      const stats = connectionManager.getStats();

      expect(stats.connected).toBe(true);
      expect(stats.lastSuccessfulConnection).toBeInstanceOf(Date);
      expect(stats.connectionAttempts).toBe(0);
      expect(stats.circuitBreakerOpen).toBe(false);
    });

    it('should track connection attempts on failures', async () => {
      const mockConnection = vi.fn()
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValue([{ test: 1, db: 'test_db' }]);
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';
      await connectionManager.getConnection(connectionString);

      const stats = connectionManager.getStats();

      expect(stats.connectionAttempts).toBe(0); // Reset after success
    });

    it('should monitor circuit breaker status', async () => {
      const mockConnection = vi.fn().mockRejectedValue(new Error('Connection failed'));
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';

      try {
        await connectionManager.getConnection(connectionString);
      } catch {
        // Circuit breaker will open
      }

      const stats = connectionManager.getStats();

      expect(stats.circuitBreakerOpen).toBe(true);
      expect(stats.circuitBreakerResetTime).toBeInstanceOf(Date);
    });
  });

  describe('Automatic Reconnection Logic', () => {
    it('should automatically retry connection on failure', async () => {
      const mockConnection = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue([{ test: 1, db: 'test_db' }]);
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';
      const connection = await connectionManager.getConnection(connectionString);

      expect(connection).toBeDefined();
      expect(postgres).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should use exponential backoff for retries', async () => {
      const mockConnection = vi.fn()
        .mockRejectedValueOnce(new Error('Retry 1'))
        .mockRejectedValueOnce(new Error('Retry 2'))
        .mockResolvedValue([{ test: 1, db: 'test_db' }]);
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';
      const startTime = Date.now();
      await connectionManager.getConnection(connectionString);
      const duration = Date.now() - startTime;

      // Should have some delay from exponential backoff
      expect(duration).toBeGreaterThan(1000); // At least 1 second from retries
    });

    it('should reuse existing healthy connection', async () => {
      const mockConnection = vi.fn().mockResolvedValue([{ test: 1, db: 'test_db' }]);
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';

      const connection1 = await connectionManager.getConnection(connectionString);
      const connection2 = await connectionManager.getConnection(connectionString);

      expect(connection1).toBe(connection2);
      expect(postgres).toHaveBeenCalledTimes(1); // Only one actual connection
    });

    it('should recreate stale connections', async () => {
      const mockConnection = vi.fn().mockResolvedValue([{ test: 1, db: 'test_db' }]);
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';

      // First connection
      await connectionManager.getConnection(connectionString);

      // Mock time passing (6 minutes)
      const stats = connectionManager.getStats();
      if (stats.lastSuccessfulConnection) {
        stats.lastSuccessfulConnection.setTime(
          Date.now() - (6 * 60 * 1000)
        );
      }

      // Second connection should recreate
      await connectionManager.getConnection(connectionString);

      expect(postgres).toHaveBeenCalledTimes(2);
    });
  });

  describe('Connection Timeout and Retry Mechanisms', () => {
    it('should timeout connection after specified duration', async () => {
      const mockConnection = vi.fn().mockRejectedValue(new Error('Connection timeout'));
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';

      await expect(
        connectionManager.getConnection(connectionString)
      ).rejects.toThrow();
    });

    it('should handle connection timeout with retry', async () => {
      const mockConnection = vi.fn()
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValue([{ test: 1, db: 'test_db' }]);
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';
      const connection = await connectionManager.getConnection(connectionString);

      expect(connection).toBeDefined();
    });

    it('should fail after max retry attempts', async () => {
      const mockConnection = vi.fn().mockRejectedValue(new Error('Persistent failure'));
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';

      await expect(
        connectionManager.getConnection(connectionString)
      ).rejects.toThrow();
    });

    it('should open circuit breaker after threshold failures', async () => {
      const mockConnection = vi.fn().mockRejectedValue(new Error('Connection failed'));
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';

      // First attempt - opens circuit breaker
      try {
        await connectionManager.getConnection(connectionString);
      } catch {
        // Expected failure
      }

      const stats = connectionManager.getStats();
      expect(stats.circuitBreakerOpen).toBe(true);
    });
  });

  describe('Simulated Connection Failures', () => {
    it('should handle network errors gracefully', async () => {
      const mockConnection = vi.fn().mockRejectedValue({
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND postgres',
        address: 'postgres',
        port: 5432
      });
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@postgres:5432/test';

      await expect(
        connectionManager.getConnection(connectionString)
      ).rejects.toThrow();
    });

    it('should handle authentication failures', async () => {
      const mockConnection = vi.fn().mockRejectedValue({
        code: '28P01',
        message: 'password authentication failed for user "test"'
      });
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:wrongpass@localhost:5432/test';

      await expect(
        connectionManager.getConnection(connectionString)
      ).rejects.toThrow();
    });

    it('should handle database not found errors', async () => {
      const mockConnection = vi.fn().mockRejectedValue({
        code: '3D000',
        message: 'database "nonexistent" does not exist'
      });
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/nonexistent';

      await expect(
        connectionManager.getConnection(connectionString)
      ).rejects.toThrow();
    });

    it('should recover from transient failures', async () => {
      const mockConnection = vi.fn()
        .mockRejectedValueOnce({ code: 'ECONNREFUSED', message: 'Connection refused' })
        .mockResolvedValue([{ test: 1, db: 'test_db' }]);
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';
      const connection = await connectionManager.getConnection(connectionString);

      expect(connection).toBeDefined();
      const stats = connectionManager.getStats();
      expect(stats.connected).toBe(true);
    });
  });

  describe('Enhanced Health Check Methods', () => {
    it('should provide detailed connection status', async () => {
      const mockConnection = vi.fn().mockResolvedValue([{ test: 1, db: 'test_db' }]);
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';
      await connectionManager.getConnection(connectionString);

      const stats = connectionManager.getStats();

      expect(stats).toEqual(
        expect.objectContaining({
          connected: true,
          lastSuccessfulConnection: expect.any(Date),
          connectionAttempts: 0,
          circuitBreakerOpen: false,
          circuitBreakerResetTime: null
        })
      );
    });

    it('should validate connection pool health', async () => {
      const mockConnection = vi.fn().mockResolvedValue([{ health: 1 }]);
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';
      await connectionManager.getConnection(connectionString);

      const isHealthy = await connectionManager.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it('should detect connection degradation', async () => {
      const mockConnection = vi.fn()
        .mockResolvedValueOnce([{ test: 1, db: 'test_db' }])
        .mockResolvedValueOnce([{ health: 1 }])
        .mockRejectedValue(new Error('Connection degraded'));
      mockConnection.end = vi.fn();

      const postgres = (await import('postgres')).default as any;
      postgres.mockReturnValue(mockConnection);

      const connectionString = 'postgresql://test:test@localhost:5432/test';
      await connectionManager.getConnection(connectionString);

      // First health check succeeds
      let isHealthy = await connectionManager.healthCheck();
      expect(isHealthy).toBe(true);

      // Connection degrades
      isHealthy = await connectionManager.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });
});
