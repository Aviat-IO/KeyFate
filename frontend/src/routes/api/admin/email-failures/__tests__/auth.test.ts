import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequireAdmin = vi.fn();
vi.mock('$lib/auth/admin-guard', () => ({
	requireAdmin: mockRequireAdmin
}));

const mockGetStats = vi.fn();
const mockQueryFailures = vi.fn();
const mockMarkResolved = vi.fn();
const mockManualRetry = vi.fn();
const mockBatchRetry = vi.fn();

const MockDeadLetterQueue = vi.fn(() => ({
	getStats: mockGetStats,
	queryFailures: mockQueryFailures,
	markResolved: mockMarkResolved,
	manualRetry: mockManualRetry,
	batchRetry: mockBatchRetry
}));

vi.mock('$lib/email/dead-letter-queue', () => ({
	DeadLetterQueue: MockDeadLetterQueue
}));

vi.mock('$lib/auth/ip-whitelist', () => ({
	getClientIp: vi.fn(() => '127.0.0.1'),
	getAdminWhitelist: vi.fn(() => ['127.0.0.1']),
	isIpWhitelisted: vi.fn(() => true)
}));

vi.mock('$lib/logger', () => ({
	logger: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
		debug: vi.fn()
	}
}));

const mockDbLimit = vi.fn();
const mockDbWhere = vi.fn(() => ({ limit: mockDbLimit }));
const mockDbFrom = vi.fn(() => ({ where: mockDbWhere }));
const mockDbSelect = vi.fn(() => ({ from: mockDbFrom }));
const mockGetDatabase = vi.fn(async () => ({ select: mockDbSelect }));

vi.mock('$lib/db/drizzle', () => ({
	getDatabase: mockGetDatabase
}));

vi.mock('$lib/db/schema', () => ({
	emailFailures: { id: 'email_failures.id' }
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => Symbol('eq'))
}));

const mockSendReminderEmail = vi.fn();
vi.mock('$lib/email/email-service', () => ({
	sendReminderEmail: mockSendReminderEmail
}));

import { GET as listEmailFailures } from '../+server';
import { GET as getEmailFailure, PATCH as resolveEmailFailure } from '../[id]/+server';
import { POST as retryEmailFailure } from '../[id]/retry/+server';
import { POST as batchRetryEmailFailures } from '../batch-retry/+server';

function makeEvent(
	path: string,
	options?: { method?: string; body?: unknown; session?: unknown; id?: string }
) {
	const request = new Request(`http://localhost${path}`, {
		method: options?.method ?? 'GET',
		headers: {
			authorization: 'Bearer admin-secret',
			...(options?.body ? { 'content-type': 'application/json' } : {})
		},
		body: options?.body ? JSON.stringify(options.body) : undefined
	});

	return {
		request,
		url: new URL(request.url),
		params: {
			id: options?.id ?? 'failure-1'
		},
		locals: {
			auth: vi.fn().mockResolvedValue(options?.session ?? null)
		}
	} as any;
}

describe('admin email-failure route authorization', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.ADMIN_TOKEN = 'admin-secret';

		mockRequireAdmin.mockImplementation(() => {
			throw { status: 303, location: '/sign-in' };
		});

		mockGetStats.mockResolvedValue({ totalFailures: 0 });
		mockQueryFailures.mockResolvedValue([
			{ id: 'failure-1', emailType: 'reminder', recipient: 'user@example.com' }
		]);
		mockMarkResolved.mockResolvedValue({
			id: 'failure-1',
			emailType: 'reminder',
			recipient: 'user@example.com',
			resolvedAt: new Date('2026-04-12T00:00:00.000Z')
		});
		mockManualRetry.mockResolvedValue({ success: true, exhausted: false, permanent: false });
		mockBatchRetry.mockResolvedValue({ total: 1, successful: 1, failed: 0, errors: [] });
		mockDbLimit.mockResolvedValue([
			{ id: 'failure-1', emailType: 'reminder', recipient: 'user@example.com' }
		]);
		mockSendReminderEmail.mockResolvedValue({ success: true });
	});

	it('rejects the list route without an authenticated admin session', async () => {
		const event = makeEvent('/api/admin/email-failures');

		await expect(listEmailFailures(event)).rejects.toMatchObject({
			status: 303,
			location: '/sign-in'
		});
		expect(event.locals.auth).toHaveBeenCalledOnce();
		expect(mockRequireAdmin).toHaveBeenCalledWith(null);
	});

	it('rejects the detail route even when ADMIN_TOKEN is unset and Bearer admin-secret is sent', async () => {
		delete process.env.ADMIN_TOKEN;
		const event = makeEvent('/api/admin/email-failures/failure-1');

		await expect(getEmailFailure(event)).rejects.toMatchObject({
			status: 303,
			location: '/sign-in'
		});
		expect(event.locals.auth).toHaveBeenCalledOnce();
		expect(mockRequireAdmin).toHaveBeenCalledWith(null);
	});

	it('rejects the resolve route without an authenticated admin session', async () => {
		const event = makeEvent('/api/admin/email-failures/failure-1', { method: 'PATCH' });

		await expect(resolveEmailFailure(event)).rejects.toMatchObject({
			status: 303,
			location: '/sign-in'
		});
		expect(event.locals.auth).toHaveBeenCalledOnce();
		expect(mockRequireAdmin).toHaveBeenCalledWith(null);
	});

	it('rejects the single retry route without an authenticated admin session', async () => {
		const event = makeEvent('/api/admin/email-failures/failure-1/retry', { method: 'POST' });

		await expect(retryEmailFailure(event)).rejects.toMatchObject({
			status: 303,
			location: '/sign-in'
		});
		expect(event.locals.auth).toHaveBeenCalledOnce();
		expect(mockRequireAdmin).toHaveBeenCalledWith(null);
	});

	it('rejects the batch retry route without an authenticated admin session', async () => {
		const event = makeEvent('/api/admin/email-failures/batch-retry', {
			method: 'POST',
			body: { failureIds: ['failure-1'] }
		});

		await expect(batchRetryEmailFailures(event)).rejects.toMatchObject({
			status: 303,
			location: '/sign-in'
		});
		expect(event.locals.auth).toHaveBeenCalledOnce();
		expect(mockRequireAdmin).toHaveBeenCalledWith(null);
	});
});
