/**
 * Simplified tests for check-secrets cron job
 * Using mocks instead of real database
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/cron/check-secrets/route';

// Mock dependencies
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@/lib/email/email-service', () => ({
  sendReminderEmail: vi.fn(),
}));

vi.mock('@/lib/email/email-failure-logger', () => ({
  logEmailFailure: vi.fn(),
}));

import { db } from '@/lib/db/drizzle';
import { sendReminderEmail } from '@/lib/email/email-service';
import { logEmailFailure } from '@/lib/email/email-failure-logger';

describe('POST /api/cron/check-secrets', () => {
  const validToken = process.env.CRON_SECRET || 'test-cron-secret';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no secrets
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    // Default: email succeeds
    vi.mocked(sendReminderEmail).mockResolvedValue({
      success: true,
      messageId: 'test-msg-id',
    } as any);
  });

  it('should reject unauthorized requests', async () => {
    const req = new Request('http://localhost:3000/api/cron/check-secrets', {
      method: 'POST',
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should accept valid CRON_SECRET', async () => {
    const req = new Request('http://localhost:3000/api/cron/check-secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${validToken}`,
      },
    });

    const response = await POST(req as any);

    expect(response.status).toBe(200);
  });

  it('should return reminder statistics', async () => {
    const req = new Request('http://localhost:3000/api/cron/check-secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${validToken}`,
      },
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(data).toHaveProperty('remindersProcessed');
    expect(data).toHaveProperty('remindersSent');
    expect(data).toHaveProperty('remindersFailed');
    expect(data).toHaveProperty('timestamp');
  });
});
