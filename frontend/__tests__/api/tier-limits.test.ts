import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/db/drizzle', () => ({
  secretsService: {
    create: vi.fn(),
    getById: vi.fn(),
  },
  getDatabase: vi.fn(),
}));

vi.mock('@/lib/auth/user-verification', () => ({
  ensureUserExists: vi.fn().mockResolvedValue({ exists: true, created: false })
}));

vi.mock('@/lib/encryption', () => ({
  encryptMessage: vi.fn().mockResolvedValue({
    encrypted: 'encrypted-share',
    iv: 'test-iv',
    authTag: 'test-auth-tag'
  })
}));

const mockGetServerSession = vi.mocked(getServerSession);

describe('Tier Limits - Free Tier Secret Limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }
    } as any);
  });

  describe('Free Tier - 1 Active Secret Limit', () => {
    it('should allow creating first secret for free user', async () => {
      vi.doMock('@/lib/subscription', () => ({
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
      }));

      const { POST: createSecret } = await import('@/app/api/secrets/route');
      const { secretsService } = await import('@/lib/db/drizzle');

      vi.mocked(secretsService.create).mockResolvedValue({
        id: 'secret-1',
        userId: 'user-123',
        title: 'First Secret',
        status: 'active',
      } as any);

      const requestBody = {
        title: 'First Secret',
        recipients: [{ name: 'John Doe', email: 'john@example.com' }],
        check_in_days: 7,
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

      expect(response.status).toBe(201);
    });

    it('should prevent creating second active secret for free user', async () => {
      vi.doMock('@/lib/subscription', () => ({
        canUserCreateSecret: vi.fn().mockResolvedValue(false),
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
            secrets: { canCreate: false, current: 1, max: 1 },
            recipients: { current: 1, max: 1 }
          },
          usage: { secrets_count: 1, total_recipients: 1 }
        }),
        isIntervalAllowed: vi.fn().mockReturnValue(true),
      }));

      const { POST: createSecret } = await import('@/app/api/secrets/route');

      const requestBody = {
        title: 'Second Secret',
        recipients: [{ name: 'Jane Doe', email: 'jane@example.com' }],
        check_in_days: 7,
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
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Secret limit reached');
      expect(data.error).toContain('free');
      expect(data.error).toContain('1 secret');
      expect(data).toHaveProperty('code', 'TIER_LIMIT_EXCEEDED');
    });

    it('should count only active secrets towards limit', async () => {
      vi.doMock('@/lib/subscription', () => ({
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
        calculateUserUsage: vi.fn().mockResolvedValue({
          secrets_count: 0,
          total_recipients: 0
        })
      }));

      const { POST: createSecret } = await import('@/app/api/secrets/route');
      const { secretsService } = await import('@/lib/db/drizzle');

      vi.mocked(secretsService.create).mockResolvedValue({
        id: 'secret-2',
        userId: 'user-123',
        title: 'New Active Secret',
        status: 'active',
      } as any);

      const requestBody = {
        title: 'New Active Secret',
        recipients: [{ name: 'John Doe', email: 'john@example.com' }],
        check_in_days: 7,
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

      expect(response.status).toBe(201);
    });
  });
});
