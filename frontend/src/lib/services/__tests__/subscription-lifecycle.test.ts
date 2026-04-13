import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDatabase = vi.fn();
const mockLogSubscriptionChanged = vi.fn();
const mockGetTierByName = vi.fn();
const mockGetTierById = vi.fn();
const mockSendSubscriptionConfirmation = vi.fn();
const mockSendSubscriptionCancelledNotification = vi.fn();

vi.mock('$lib/db/drizzle', () => ({
	getDatabase: mockGetDatabase
}));

vi.mock('$lib/db/schema', () => ({
	userSubscriptions: {
		id: 'user_subscriptions.id',
		userId: 'user_subscriptions.user_id',
		provider: 'user_subscriptions.provider',
		providerSubscriptionId: 'user_subscriptions.provider_subscription_id',
		status: 'user_subscriptions.status'
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

vi.mock('$lib/constants/tiers', () => ({
	getPriceInCents: vi.fn(() => 900)
}));

vi.mock('$lib/services/tier-service', () => ({
	getTierByName: mockGetTierByName,
	getTierById: mockGetTierById
}));

vi.mock('$lib/email/email-service', () => ({
	emailService: {
		sendSubscriptionConfirmation: mockSendSubscriptionConfirmation,
		sendSubscriptionCancelledNotification: mockSendSubscriptionCancelledNotification,
		sendPaymentFailedNotification: vi.fn()
	}
}));

vi.mock('$lib/logger', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn()
	}
}));

import { cancelSubscription, createSubscription } from '$lib/services/subscription-lifecycle';

function createMockDb() {
	const insertReturning = vi.fn();
	const insertOnConflictDoNothing = vi.fn(() => ({ returning: insertReturning }));
	const insertValues = vi.fn(() => ({ onConflictDoNothing: insertOnConflictDoNothing }));
	const insert = vi.fn(() => ({ values: insertValues }));

	const updateReturning = vi.fn();
	const updateWhere = vi.fn(() => ({ returning: updateReturning }));
	const updateSet = vi.fn(() => ({ where: updateWhere }));
	const update = vi.fn(() => ({ set: updateSet }));

	const db = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn(),
		insert,
		update
	};

	return {
		db,
		insert,
		insertValues,
		insertOnConflictDoNothing,
		insertReturning,
		update,
		updateSet,
		updateWhere,
		updateReturning
	};
}

describe('subscription lifecycle replay safety', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetTierByName.mockResolvedValue({ id: 'tier-pro', name: 'pro' });
		mockGetTierById.mockResolvedValue({ id: 'tier-pro', name: 'pro' });
		mockSendSubscriptionConfirmation.mockResolvedValue(undefined);
		mockSendSubscriptionCancelledNotification.mockResolvedValue(undefined);
		mockLogSubscriptionChanged.mockResolvedValue(undefined);
	});

	it('does not recreate or resend confirmation email for duplicate provider subscriptions', async () => {
		const { db, insert } = createMockDb();
		const existingSubscription = {
			id: 'sub-1',
			userId: 'user-123',
			provider: 'btcpay',
			providerSubscriptionId: 'invoice-123',
			status: 'active'
		};

		db.limit.mockResolvedValue([existingSubscription]);
		mockGetDatabase.mockResolvedValue(db);

		const result = await createSubscription({
			userId: 'user-123',
			provider: 'btcpay',
			providerCustomerId: null,
			providerSubscriptionId: 'invoice-123',
			tierName: 'pro',
			status: 'active',
			currentPeriodStart: new Date('2026-04-13T00:00:00Z'),
			currentPeriodEnd: new Date('2026-05-13T00:00:00Z'),
			cancelAtPeriodEnd: false
		});

		expect(result).toEqual(existingSubscription);
		expect(insert).not.toHaveBeenCalled();
		expect(mockLogSubscriptionChanged).not.toHaveBeenCalled();
		expect(mockSendSubscriptionConfirmation).not.toHaveBeenCalled();
	});

	it('does not resend cancellation email when subscription is already cancelled', async () => {
		const { db, update } = createMockDb();
		const cancelledSubscription = {
			id: 'sub-1',
			userId: 'user-123',
			provider: 'stripe',
			providerSubscriptionId: 'sub_123',
			status: 'cancelled',
			cancelAtPeriodEnd: false
		};

		db.limit.mockResolvedValue([cancelledSubscription]);
		mockGetDatabase.mockResolvedValue(db);

		const result = await cancelSubscription('user-123', true);

		expect(result).toEqual(cancelledSubscription);
		expect(update).not.toHaveBeenCalled();
		expect(mockSendSubscriptionCancelledNotification).not.toHaveBeenCalled();
	});
});
