import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDatabase = vi.fn();
const mockLogSubscriptionChanged = vi.fn();

vi.mock('$lib/db/drizzle', () => ({
	getDatabase: mockGetDatabase
}));

vi.mock('$lib/db/schema', () => ({
	paymentHistory: {
		id: 'payment_history.id',
		provider: 'payment_history.provider',
		providerPaymentId: 'payment_history.provider_payment_id'
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
	and: vi.fn((...args: unknown[]) => args)
}));

vi.mock('$lib/services/audit-logger', () => ({
	logSubscriptionChanged: mockLogSubscriptionChanged,
	logCheckIn: vi.fn(),
	logLogin: vi.fn()
}));

vi.mock('$lib/logger', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn()
	}
}));

import { createPaymentRecord } from '$lib/services/payment-records';

function createMockDb() {
	const insertReturning = vi.fn();
	const insertOnConflictDoNothing = vi.fn(() => ({ returning: insertReturning }));
	const insertValues = vi.fn(() => ({ onConflictDoNothing: insertOnConflictDoNothing }));
	const insert = vi.fn(() => ({ values: insertValues }));

	const db = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn(),
		insert
	};

	return { db, insert, insertOnConflictDoNothing, insertReturning };
}

describe('payment record replay safety', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLogSubscriptionChanged.mockResolvedValue(undefined);
	});

	it('does not create or audit duplicate payment records for the same provider payment id', async () => {
		const { db, insert } = createMockDb();
		const existingPayment = {
			id: 'payment-1',
			provider: 'stripe',
			providerPaymentId: 'pi_123',
			status: 'succeeded'
		};

		db.limit.mockResolvedValue([existingPayment]);
		mockGetDatabase.mockResolvedValue(db);

		const result = await createPaymentRecord({
			userId: 'user-123',
			subscriptionId: 'sub-1',
			provider: 'stripe',
			providerPaymentId: 'pi_123',
			amount: 9,
			currency: 'USD',
			status: 'succeeded',
			metadata: { invoiceId: 'in_123' }
		});

		expect(result).toEqual(existingPayment);
		expect(insert).not.toHaveBeenCalled();
		expect(mockLogSubscriptionChanged).not.toHaveBeenCalled();
	});
});
