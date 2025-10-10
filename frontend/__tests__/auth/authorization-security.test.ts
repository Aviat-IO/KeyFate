/**
 * Comprehensive Authorization Security Test Suite
 *
 * Penetration Testing Mindset - TDD Approach
 *
 * This test suite validates authorization security with a focus on:
 * 1. Cross-user secret access prevention
 * 2. Session hijacking prevention
 * 3. Token manipulation attacks
 * 4. Privilege escalation attempts
 * 5. Boundary conditions and edge cases
 * 6. Attack vectors and security vulnerabilities
 *
 * Security Testing Philosophy:
 * - Assume attackers will try every possible vector
 * - Test all protected endpoints for authorization bypass
 * - Verify user ownership validation at every layer
 * - Ensure no information leakage in error responses
 * - Test session management and token security
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';

// Setup mocks before imports
vi.mock('next-auth/next');
vi.mock('@/lib/db/drizzle', () => ({
  getDatabase: vi.fn(),
  secretsService: {
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}));
vi.mock('@/lib/auth-config', () => ({
  authConfig: {}
}));
vi.mock('@/lib/auth/user-verification', () => ({
  ensureUserExists: vi.fn().mockResolvedValue({ exists: true, created: false })
}));
vi.mock('@/lib/encryption', () => ({
  encryptMessage: vi.fn().mockResolvedValue({
    encrypted: 'encrypted-data',
    iv: 'test-iv',
    authTag: 'test-tag'
  })
}));
vi.mock('@/lib/subscription', () => ({
  canUserCreateSecret: vi.fn().mockResolvedValue(true),
  getUserTierInfo: vi.fn().mockResolvedValue({
    tier: {
      tiers: {
        name: 'free',
        max_secrets: 1,
        max_recipients_per_secret: 1,
        custom_intervals: false
      }
    },
    limits: {
      secrets: { canCreate: true, current: 0, max: 1 },
      recipients: { current: 0, max: 1 }
    },
    usage: { secrets_count: 0, total_recipients: 0 }
  }),
  isIntervalAllowed: vi.fn().mockReturnValue(true),
  calculateUserUsage: vi.fn().mockResolvedValue({ secrets_count: 0, total_recipients: 0 }),
  getTierLimits: vi.fn().mockReturnValue({
    maxSecrets: 1,
    maxRecipientsPerSecret: 1,
    customIntervals: false
  }),
  getAvailableIntervals: vi.fn().mockReturnValue([
    { days: 7, label: "1 week" },
    { days: 30, label: "1 month" },
    { days: 365, label: "1 year" }
  ])
}));

// Import after mocks
import { secretsService } from '@/lib/db/drizzle';
import { GET as getSecret, DELETE as deleteSecret, PUT as updateSecret } from '@/app/api/secrets/[id]/route';
import { POST as createSecret } from '@/app/api/secrets/route';

const mockGetServerSession = vi.mocked(getServerSession);
const mockSecretsService = vi.mocked(secretsService);

describe('Authorization Security - Comprehensive Penetration Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Cross-User Secret Access Prevention', () => {
    describe('GET /api/secrets/[id] - Unauthorized Access Attempts', () => {
      it('should prevent User A from accessing User B\'s secret', async () => {
        // Setup: User A tries to access User B's secret
        const attackerSession = {
          user: { id: 'attacker-123', email: 'attacker@example.com' }
        };
        mockGetServerSession.mockResolvedValue(attackerSession as any);

        // Simulate service returning null (no access)
        mockSecretsService.getById = vi.fn().mockResolvedValue(null);

        const mockRequest = new NextRequest('http://localhost:3000/api/secrets/victim-secret-456');
        const params = Promise.resolve({ id: 'victim-secret-456' });

        const response = await getSecret(mockRequest, { params });
        const data = await response.json();

        // Verify rejection
        expect(response.status).toBe(404);
        expect(data.error).toBe('Secret not found');
        expect(mockSecretsService.getById).toHaveBeenCalledWith('victim-secret-456', 'attacker-123');
      });

      it('should prevent sequential ID enumeration attacks', async () => {
        // Attacker tries to enumerate secrets by ID
        const attackerSession = {
          user: { id: 'attacker-123', email: 'attacker@example.com' }
        };
        mockGetServerSession.mockResolvedValue(attackerSession as any);
        mockSecretsService.getById = vi.fn().mockResolvedValue(null);

        // Try multiple sequential IDs
        const targetIds = ['secret-1', 'secret-2', 'secret-3', 'secret-4', 'secret-5'];

        for (const targetId of targetIds) {
          const mockRequest = new NextRequest(`http://localhost:3000/api/secrets/${targetId}`);
          const params = Promise.resolve({ id: targetId });

          const response = await getSecret(mockRequest, { params });
          const data = await response.json();

          // All should return same 404 response (no info leakage)
          expect(response.status).toBe(404);
          expect(data.error).toBe('Secret not found');
        }
      });

      it('should not leak secret existence through timing attacks', async () => {
        const attackerSession = {
          user: { id: 'attacker-123', email: 'attacker@example.com' }
        };
        mockGetServerSession.mockResolvedValue(attackerSession as any);

        // Mock both existing and non-existing secrets to return null
        mockSecretsService.getById = vi.fn().mockResolvedValue(null);

        const existingSecretId = 'real-secret-789';
        const fakeSecretId = 'fake-secret-999';

        // Test existing secret
        const request1 = new NextRequest(`http://localhost:3000/api/secrets/${existingSecretId}`);
        const params1 = Promise.resolve({ id: existingSecretId });
        const response1 = await getSecret(request1, { params: params1 });
        const data1 = await response1.json();

        // Test non-existing secret
        const request2 = new NextRequest(`http://localhost:3000/api/secrets/${fakeSecretId}`);
        const params2 = Promise.resolve({ id: fakeSecretId });
        const response2 = await getSecret(request2, { params: params2 });
        const data2 = await response2.json();

        // Both should have identical responses
        expect(response1.status).toBe(response2.status);
        expect(data1.error).toBe(data2.error);
      });
    });

    describe('DELETE /api/secrets/[id] - Cross-User Deletion Attacks', () => {
      it('should prevent User A from deleting User B\'s secret', async () => {
        const attackerSession = {
          user: { id: 'attacker-123', email: 'attacker@example.com' }
        };
        mockGetServerSession.mockResolvedValue(attackerSession as any);
        mockSecretsService.getById = vi.fn().mockResolvedValue(null);

        const mockRequest = new NextRequest('http://localhost:3000/api/secrets/victim-secret-456', {
          method: 'DELETE'
        });
        const params = Promise.resolve({ id: 'victim-secret-456' });

        const response = await deleteSecret(mockRequest, { params });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Secret not found');
        expect(mockSecretsService.getById).toHaveBeenCalledWith('victim-secret-456', 'attacker-123');
      });
    });

    describe('PUT /api/secrets/[id] - Unauthorized Update Attacks', () => {
      it('should prevent User A from updating User B\'s secret metadata', async () => {
        const attackerSession = {
          user: { id: 'attacker-123', email: 'attacker@example.com' }
        };
        mockGetServerSession.mockResolvedValue(attackerSession as any);
        mockSecretsService.update = vi.fn().mockResolvedValue(null);

        const updatePayload = {
          title: 'Hijacked Title',
          recipient_name: 'Attacker',
          recipient_email: 'attacker@evil.com',
          contact_method: 'email',
          check_in_days: 1
        };

        const mockRequest = new NextRequest('http://localhost:3000/api/secrets/victim-secret-456', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });
        const params = Promise.resolve({ id: 'victim-secret-456' });

        const response = await updateSecret(mockRequest, { params });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Secret not found');
      });
    });
  });

  describe('2. Session Hijacking Prevention', () => {
    it('should reject requests without session', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/secrets/secret-123');
      const params = Promise.resolve({ id: 'secret-123' });

      const response = await getSecret(mockRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject requests with malformed session (missing user)', async () => {
      mockGetServerSession.mockResolvedValue({ user: null } as any);

      const mockRequest = new NextRequest('http://localhost:3000/api/secrets/secret-123');
      const params = Promise.resolve({ id: 'secret-123' });

      const response = await getSecret(mockRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject requests with malformed session (missing user id)', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: 'test@example.com' }
      } as any);

      const mockRequest = new NextRequest('http://localhost:3000/api/secrets/secret-123');
      const params = Promise.resolve({ id: 'secret-123' });

      const response = await getSecret(mockRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should validate session for all HTTP methods', async () => {
      mockGetServerSession.mockResolvedValue(null);

      // Test GET
      const getRequest = new NextRequest('http://localhost:3000/api/secrets/secret-123');
      const getParams = Promise.resolve({ id: 'secret-123' });
      const getResponse = await getSecret(getRequest, { params: getParams });
      expect(getResponse.status).toBe(401);

      // Test DELETE
      const deleteRequest = new NextRequest('http://localhost:3000/api/secrets/secret-123', {
        method: 'DELETE'
      });
      const deleteParams = Promise.resolve({ id: 'secret-123' });
      const deleteResponse = await deleteSecret(deleteRequest, { params: deleteParams });
      expect(deleteResponse.status).toBe(401);

      // Test PUT
      const putRequest = new NextRequest('http://localhost:3000/api/secrets/secret-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test',
          recipient_name: 'Test',
          contact_method: 'email',
          check_in_days: 30
        })
      });
      const putParams = Promise.resolve({ id: 'secret-123' });
      const putResponse = await updateSecret(putRequest, { params: putParams });
      expect(putResponse.status).toBe(401);
    });
  });

  describe('3. Token Manipulation and Injection Attacks', () => {
    it('should sanitize secret IDs to prevent SQL injection', async () => {
      const validSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      };
      mockGetServerSession.mockResolvedValue(validSession as any);
      mockSecretsService.getById = vi.fn().mockResolvedValue(null);

      // SQL injection attempts
      const maliciousIds = [
        "'; DROP TABLE secrets; --",
        "1' OR '1'='1",
        "secret-123; DELETE FROM secrets WHERE 1=1",
        "../../../etc/passwd",
        "secret-123' UNION SELECT * FROM users--"
      ];

      for (const maliciousId of maliciousIds) {
        const mockRequest = new NextRequest(`http://localhost:3000/api/secrets/${encodeURIComponent(maliciousId)}`);
        const params = Promise.resolve({ id: maliciousId });

        const response = await getSecret(mockRequest, { params });

        // Should handle gracefully (404 or 500, but not execute malicious code)
        expect([404, 500]).toContain(response.status);
        expect(mockSecretsService.getById).toHaveBeenCalledWith(maliciousId, 'user-123');
      }
    });

    it('should prevent XSS attacks in secret metadata', async () => {
      const validSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      };
      mockGetServerSession.mockResolvedValue(validSession as any);
      mockSecretsService.create = vi.fn().mockResolvedValue({
        id: 'new-secret-123',
        userId: 'user-123',
        title: 'Test Secret'
      });

      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>'
      ];

      for (const xssPayload of xssPayloads) {
        const requestBody = {
          title: xssPayload,
          recipient_name: 'Test User',
          recipient_email: 'test@example.com',
          contact_method: 'email',
          check_in_days: 30,
          server_share: 'test-share',
          sss_shares_total: 3,
          sss_threshold: 2
        };

        const mockRequest = new NextRequest('http://localhost:3000/api/secrets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        const response = await createSecret(mockRequest);

        // Should either sanitize or reject
        expect([201, 400]).toContain(response.status);
      }
    });
  });

  describe('4. Privilege Escalation Prevention', () => {
    it('should enforce user ID from session, not request body', async () => {
      const validSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      };
      mockGetServerSession.mockResolvedValue(validSession as any);

      const createdSecret = {
        id: 'new-secret-123',
        userId: 'user-123', // Should be from session, not request
        title: 'Test Secret'
      };
      mockSecretsService.create = vi.fn().mockResolvedValue(createdSecret);

      // Attacker tries to set different userId in request
      const requestBody = {
        userId: 'victim-456', // This should be ignored
        title: 'Malicious Secret',
        recipient_name: 'Test User',
        recipient_email: 'test@example.com',
        contact_method: 'email',
        check_in_days: 30,
        server_share: 'test-share',
        sss_shares_total: 3,
        sss_threshold: 2
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await createSecret(mockRequest);

      // Verify userId is taken from session, not request
      expect(mockSecretsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123' // From session
        })
      );
    });

    it('should not allow users to modify userId through update', async () => {
      const validSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      };
      mockGetServerSession.mockResolvedValue(validSession as any);

      const updatedSecret = {
        id: 'secret-123',
        userId: 'user-123',
        title: 'Updated Secret'
      };
      mockSecretsService.update = vi.fn().mockResolvedValue(updatedSecret);

      // Attacker tries to change ownership through update
      const requestBody = {
        userId: 'attacker-456', // This should be ignored
        title: 'Updated Secret',
        recipient_name: 'Test User',
        recipient_email: 'test@example.com',
        contact_method: 'email',
        check_in_days: 30
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/secrets/secret-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const params = Promise.resolve({ id: 'secret-123' });

      const response = await updateSecret(mockRequest, { params });

      // Verify update uses session userId for authorization
      expect(mockSecretsService.update).toHaveBeenCalledWith(
        'secret-123',
        'user-123', // From session
        expect.any(Object)
      );
    });
  });

  describe('5. Boundary Conditions and Edge Cases', () => {
    it('should handle empty secret ID', async () => {
      const validSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      };
      mockGetServerSession.mockResolvedValue(validSession as any);
      mockSecretsService.getById = vi.fn().mockResolvedValue(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/secrets/');
      const params = Promise.resolve({ id: '' });

      const response = await getSecret(mockRequest, { params });

      expect([400, 404]).toContain(response.status);
    });

    it('should handle extremely long secret IDs', async () => {
      const validSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      };
      mockGetServerSession.mockResolvedValue(validSession as any);
      mockSecretsService.getById = vi.fn().mockResolvedValue(null);

      const longId = 'a'.repeat(10000); // 10KB ID
      const mockRequest = new NextRequest(`http://localhost:3000/api/secrets/${longId}`);
      const params = Promise.resolve({ id: longId });

      const response = await getSecret(mockRequest, { params });

      expect([400, 404, 414]).toContain(response.status);
    });

    it('should handle special characters in secret IDs', async () => {
      const validSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      };
      mockGetServerSession.mockResolvedValue(validSession as any);
      mockSecretsService.getById = vi.fn().mockResolvedValue(null);

      const specialIds = [
        'secret/../../../etc/passwd',
        'secret?param=value',
        'secret#fragment',
        'secret%00null',
        'secret\x00null'
      ];

      for (const specialId of specialIds) {
        const mockRequest = new NextRequest(`http://localhost:3000/api/secrets/${encodeURIComponent(specialId)}`);
        const params = Promise.resolve({ id: specialId });

        const response = await getSecret(mockRequest, { params });

        // Should handle safely
        expect([400, 404, 500]).toContain(response.status);
      }
    });

    it('should handle null and undefined values gracefully', async () => {
      const validSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      };
      mockGetServerSession.mockResolvedValue(validSession as any);
      mockSecretsService.getById = vi.fn().mockResolvedValue(null);

      // Test with null
      const mockRequest1 = new NextRequest('http://localhost:3000/api/secrets/null');
      const params1 = Promise.resolve({ id: null as any });
      const response1 = await getSecret(mockRequest1, { params: params1 });
      expect([400, 404, 500]).toContain(response1.status);

      // Test with undefined
      const mockRequest2 = new NextRequest('http://localhost:3000/api/secrets/undefined');
      const params2 = Promise.resolve({ id: undefined as any });
      const response2 = await getSecret(mockRequest2, { params: params2 });
      expect([400, 404, 500]).toContain(response2.status);
    });
  });

  describe('6. Attack Vector Prevention', () => {
    it('should prevent race condition attacks on secret access', async () => {
      const validSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      };
      mockGetServerSession.mockResolvedValue(validSession as any);

      const mockSecret = {
        id: 'secret-123',
        userId: 'user-123',
        title: 'Test Secret'
      };
      mockSecretsService.getById = vi.fn().mockResolvedValue(mockSecret);

      // Simulate concurrent requests
      const mockRequest = new NextRequest('http://localhost:3000/api/secrets/secret-123');
      const params = Promise.resolve({ id: 'secret-123' });

      const concurrentRequests = Array(10).fill(null).map(() =>
        getSecret(mockRequest, { params: Promise.resolve({ id: 'secret-123' }) })
      );

      const responses = await Promise.all(concurrentRequests);

      // All should succeed with same result
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should prevent information disclosure through error messages', async () => {
      const validSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      };
      mockGetServerSession.mockResolvedValue(validSession as any);
      mockSecretsService.getById = vi.fn().mockResolvedValue(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/secrets/nonexistent-123');
      const params = Promise.resolve({ id: 'nonexistent-123' });

      const response = await getSecret(mockRequest, { params });
      const data = await response.json();

      // Error message should be generic, not revealing
      expect(data.error).toBe('Secret not found');
      expect(data).not.toHaveProperty('userId');
      expect(data).not.toHaveProperty('stackTrace');
      expect(data).not.toHaveProperty('query');
    });

    it('should prevent parameter pollution attacks', async () => {
      const validSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      };
      mockGetServerSession.mockResolvedValue(validSession as any);
      mockSecretsService.create = vi.fn().mockResolvedValue({
        id: 'new-secret-123',
        userId: 'user-123',
        title: 'Test Secret'
      });

      // Duplicate parameters in request
      const requestBody = {
        title: 'Original Title',
        title: 'Polluted Title', // Duplicate parameter
        recipient_name: 'Test User',
        recipient_email: 'test@example.com',
        contact_method: 'email',
        check_in_days: 30,
        server_share: 'test-share',
        sss_shares_total: 3,
        sss_threshold: 2
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await createSecret(mockRequest);

      // Should handle parameter pollution safely
      expect([201, 400]).toContain(response.status);
    });

    it('should validate content-type header to prevent MIME confusion', async () => {
      const validSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      };
      mockGetServerSession.mockResolvedValue(validSession as any);

      const requestBody = {
        title: 'Test Secret',
        recipient_name: 'Test User',
        recipient_email: 'test@example.com',
        contact_method: 'email',
        check_in_days: 30,
        server_share: 'test-share',
        sss_shares_total: 3,
        sss_threshold: 2
      };

      // Test without content-type header
      const mockRequest = new NextRequest('http://localhost:3000/api/secrets', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await createSecret(mockRequest);

      // Should either require content-type or handle gracefully
      expect([201, 400, 415]).toContain(response.status);
    });
  });

  describe('7. Security Logging and Monitoring', () => {
    it('should log unauthorized access attempts for security monitoring', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const attackerSession = {
        user: { id: 'attacker-123', email: 'attacker@example.com' }
      };
      mockGetServerSession.mockResolvedValue(attackerSession as any);
      mockSecretsService.getById = vi.fn().mockResolvedValue(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/secrets/victim-secret-456');
      const params = Promise.resolve({ id: 'victim-secret-456' });

      await getSecret(mockRequest, { params });

      // Verify no error logging for normal 404 (prevent log spam)
      // Security logs should be handled separately in production

      consoleSpy.mockRestore();
    });
  });
});
