/**
 * Simplified tests for check-secrets cron job
 * Using mocks instead of real database
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create mock DB instance
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockExecute = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
const mockWhere = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  execute: mockExecute,
};

// Mock dependencies
vi.mock('@/lib/db/drizzle', () => ({
  getDatabase: vi.fn(() => Promise.resolve(mockDb)),
}));

vi.mock('@/lib/email/email-service', () => ({
  sendReminderEmail: vi.fn(),
}));

vi.mock('@/lib/email/email-failure-logger', () => ({
  logEmailFailure: vi.fn(),
}));

vi.mock('@/lib/email/admin-notification-service', () => ({
  sendAdminNotification: vi.fn(),
}));

import { POST } from '@/app/api/cron/check-secrets/route';
import { sendReminderEmail } from '@/lib/email/email-service';

describe('POST /api/cron/check-secrets', () => {
  const validToken = process.env.CRON_SECRET || 'test-cron-secret';

  beforeEach(() => {
    // Clear all mock history and implementations
    vi.clearAllMocks();
    mockSelect.mockClear();
    mockInsert.mockClear();
    mockExecute.mockClear();
    mockFrom.mockClear();
    mockInnerJoin.mockClear();
    mockWhere.mockClear();

    // Setup mock chain for the main secrets query
    mockWhere.mockResolvedValue([]);
    mockInnerJoin.mockReturnValue({ where: mockWhere });
    mockFrom.mockReturnValue({ innerJoin: mockInnerJoin });

    // Mock the reminder_jobs count query (first select call)
    // Mock the main secrets query (second select call)
    mockSelect
      .mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([{ count: 0 }]),
      })
      .mockReturnValueOnce({
        from: mockFrom,
      });

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
