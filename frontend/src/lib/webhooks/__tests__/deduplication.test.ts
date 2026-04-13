import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDatabase = vi.fn();
const mockSql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
	strings,
	values
}));

vi.mock('$lib/db/drizzle', () => ({
	getDatabase: mockGetDatabase
}));

vi.mock('$lib/db/schema', () => ({
	webhookEvents: {
		id: 'webhook_events.id',
		provider: 'webhook_events.provider',
		eventId: 'webhook_events.event_id',
		eventType: 'webhook_events.event_type',
		payload: 'webhook_events.payload',
		status: 'webhook_events.status',
		retryCount: 'webhook_events.retry_count',
		processedAt: 'webhook_events.processed_at',
		createdAt: 'webhook_events.created_at',
		updatedAt: 'webhook_events.updated_at'
	}
}));

vi.mock('drizzle-orm', () => ({
	and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
	eq: vi.fn((a: unknown, b: unknown) => ({ op: 'eq', a, b })),
	lt: vi.fn((a: unknown, b: unknown) => ({ op: 'lt', a, b })),
	sql: mockSql
}));

vi.mock('$lib/logger', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn()
	}
}));

import {
	claimWebhookEvent,
	finalizeWebhookEventProcessing,
	markWebhookEventFailed,
	recordWebhookEvent
} from '$lib/webhooks/deduplication';

function getClaimConfig(mockOnConflictDoUpdate: ReturnType<typeof vi.fn>) {
	const claimCall = mockOnConflictDoUpdate.mock.calls[0];
	if (!claimCall) {
		throw new Error('Expected onConflictDoUpdate to be called');
	}

	return claimCall[0] as {
		target?: unknown;
		set?: unknown;
		setWhere?: unknown;
	};
}

describe('webhook deduplication', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('claims a webhook event atomically for the first delivery', async () => {
		const mockReturning = vi.fn().mockResolvedValue([{ id: 'claimed' }]);
		const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }));
		const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
		const mockInsert = vi.fn(() => ({ values: mockValues }));

		mockGetDatabase.mockResolvedValue({
			insert: mockInsert
		});

		const claimed = await claimWebhookEvent('stripe', 'evt_123', 'invoice.paid', {
			id: 'evt_123'
		});

		expect(claimed).toBe(true);
		expect(mockInsert).toHaveBeenCalled();
		expect(mockValues).toHaveBeenCalledWith(
			expect.objectContaining({
				provider: 'stripe',
				eventId: 'evt_123',
				eventType: 'invoice.paid',
				status: 'processing'
			})
		);
		const claimConfig = getClaimConfig(mockOnConflictDoUpdate);
		expect(claimConfig.target).toEqual(['webhook_events.provider', 'webhook_events.event_id']);
		expect(claimConfig.set).toEqual(
			expect.objectContaining({
				status: 'processing'
			})
		);
		expect(claimConfig.setWhere).toEqual(
			expect.objectContaining({
				strings: ["", " = 'failed' or (", " = 'processing' and ", ' < ', ')'],
				values: [
					'webhook_events.status',
					'webhook_events.status',
					'webhook_events.updated_at',
					expect.any(Date)
				]
			})
		);
	});

	it('reclaims a failed webhook event atomically', async () => {
		const mockReturning = vi.fn().mockResolvedValue([]);
		const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }));
		const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
		const mockInsert = vi.fn(() => ({ values: mockValues }));
		const reclaimedReturning = vi.fn().mockResolvedValue([{ id: 'reclaimed' }]);

		mockGetDatabase.mockResolvedValue({
			insert: mockInsert
		});
		mockOnConflictDoUpdate.mockReturnValueOnce({ returning: reclaimedReturning });

		const claimed = await claimWebhookEvent('btcpay', 'evt_dup', 'InvoiceSettled', {
			id: 'evt_dup'
		});

		expect(claimed).toBe(true);
		const claimConfig = getClaimConfig(mockOnConflictDoUpdate);
		expect(claimConfig.setWhere).toEqual(
			expect.objectContaining({
				strings: ["", " = 'failed' or (", " = 'processing' and ", ' < ', ')'],
				values: [
					'webhook_events.status',
					'webhook_events.status',
					'webhook_events.updated_at',
					expect.any(Date)
				]
			})
		);
	});

	it('reclaims a stale processing webhook event atomically', async () => {
		const mockReturning = vi.fn().mockResolvedValue([{ id: 'reclaimed' }]);
		const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }));
		const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
		const mockInsert = vi.fn(() => ({ values: mockValues }));

		mockGetDatabase.mockResolvedValue({
			insert: mockInsert
		});

		const claimed = await claimWebhookEvent('stripe', 'evt_stale', 'invoice.paid', {
			id: 'evt_stale'
		});

		expect(claimed).toBe(true);
		const claimConfig = getClaimConfig(mockOnConflictDoUpdate);
		expect(claimConfig.setWhere).toEqual(
			expect.objectContaining({
				strings: ["", " = 'failed' or (", " = 'processing' and ", ' < ', ')'],
				values: [
					'webhook_events.status',
					'webhook_events.status',
					'webhook_events.updated_at',
					expect.any(Date)
				]
			})
		);
	});

	it('rejects a duplicate delivery when another worker still owns the claim', async () => {
		const mockReturning = vi.fn().mockResolvedValue([]);
		const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }));
		const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
		const mockInsert = vi.fn(() => ({ values: mockValues }));

		mockGetDatabase.mockResolvedValue({
			insert: mockInsert
		});

		const claimed = await claimWebhookEvent('btcpay', 'evt_dup', 'InvoiceSettled', {
			id: 'evt_dup'
		});

		expect(claimed).toBe(false);
	});

	it('marks a claimed webhook event as processed after side effects succeed', async () => {
		const mockReturning = vi.fn().mockResolvedValue([{ id: 'claimed' }]);
		const mockWhere = vi.fn(() => ({ returning: mockReturning }));
		const mockSet = vi.fn(() => ({ where: mockWhere }));
		const mockUpdate = vi.fn(() => ({ set: mockSet }));

		mockGetDatabase.mockResolvedValue({
			update: mockUpdate
		});

		const recorded = await recordWebhookEvent('stripe', 'evt_123', 'invoice.paid', {
			id: 'evt_123'
		});

		expect(recorded).toBe(true);
		expect(mockUpdate).toHaveBeenCalled();
		expect(mockSet).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'processed',
				processedAt: expect.any(Date)
			})
		);
	});

	it('finalizes a webhook as processed when normal recording failed after side effects', async () => {
		const mockReturning = vi.fn().mockResolvedValue([{ id: 'claimed' }]);
		const mockWhere = vi.fn(() => ({ returning: mockReturning }));
		const mockSet = vi.fn(() => ({ where: mockWhere }));
		const mockUpdate = vi.fn(() => ({ set: mockSet }));

		mockGetDatabase.mockResolvedValue({
			update: mockUpdate
		});

		const finalized = await finalizeWebhookEventProcessing('stripe', 'evt_123');

		expect(finalized).toBe(true);
		expect(mockSet).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'processed',
				processedAt: expect.any(Date),
				errorMessage: null
			})
		);
	});

	it('marks a claimed webhook event as failed so a later delivery can retry', async () => {
		const mockReturning = vi.fn().mockResolvedValue([{ id: 'failed' }]);
		const mockWhere = vi.fn(() => ({ returning: mockReturning }));
		const mockSet = vi.fn(() => ({ where: mockWhere }));
		const mockUpdate = vi.fn(() => ({ set: mockSet }));

		mockGetDatabase.mockResolvedValue({
			update: mockUpdate
		});

		const failed = await markWebhookEventFailed('stripe', 'evt_123', 'boom');

		expect(failed).toBe(true);
		expect(mockSet).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'failed',
				errorMessage: 'boom'
			})
		);
	});
});
