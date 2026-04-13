import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockVerifyWebhookSignature = vi.fn();
const mockHandleStripeWebhook = vi.fn();
const mockSendAdminAlert = vi.fn();
const mockClaimWebhookEvent = vi.fn();
const mockRecordWebhookEvent = vi.fn();
const mockFinalizeWebhookEventProcessing = vi.fn();
const mockMarkWebhookEventFailed = vi.fn();

vi.mock('@sveltejs/kit', () => ({
	json: (data: unknown, init?: { status?: number }) =>
		new Response(JSON.stringify(data), {
			status: init?.status ?? 200,
			headers: { 'content-type': 'application/json' }
		}),
	redirect: vi.fn(),
	error: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		STRIPE_WEBHOOK_SECRET: 'whsec_test'
	}
}));

vi.mock('$lib/payment', () => ({
	getFiatPaymentProvider: () => ({
		verifyWebhookSignature: mockVerifyWebhookSignature,
		getSubscription: vi.fn()
	}),
	getCryptoPaymentProvider: vi.fn()
}));

vi.mock('$lib/server-env', () => ({
	serverEnv: {
		STRIPE_WEBHOOK_SECRET: 'whsec_test'
	}
}));

vi.mock('$lib/services/subscription-service', () => ({
	subscriptionService: {
		handleStripeWebhook: mockHandleStripeWebhook
	}
}));

vi.mock('$lib/email/email-service', () => ({
	emailService: {
		sendAdminAlert: mockSendAdminAlert
	}
}));

vi.mock('$lib/webhooks/deduplication', () => ({
	claimWebhookEvent: mockClaimWebhookEvent,
	finalizeWebhookEventProcessing: mockFinalizeWebhookEventProcessing,
	recordWebhookEvent: mockRecordWebhookEvent,
	markWebhookEventFailed: mockMarkWebhookEventFailed
}));

vi.mock('$lib/db/drizzle', () => ({
	getDatabase: vi.fn()
}));

vi.mock('$lib/db/schema', () => ({
	userSubscriptions: {
		providerSubscriptionId: 'userSubscriptions.providerSubscriptionId',
		providerCustomerId: 'userSubscriptions.providerCustomerId'
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
	or: vi.fn((...args: unknown[]) => args)
}));

vi.mock('$lib/logger', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn()
	}
}));

const loadPost = async () => (await import('../+server')).POST;

const stripeEvent = {
	id: 'evt_stripe_1',
	type: 'checkout.session.completed',
	created: new Date('2026-04-12T00:00:00Z'),
	data: {
		object: {
			metadata: {
				user_id: 'user-123'
			}
		}
	}
};

describe('POST /api/webhooks/stripe', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockVerifyWebhookSignature.mockResolvedValue(stripeEvent);
		mockRecordWebhookEvent.mockResolvedValue(true);
		mockFinalizeWebhookEventProcessing.mockResolvedValue(true);
		mockMarkWebhookEventFailed.mockResolvedValue(true);
		mockSendAdminAlert.mockResolvedValue(undefined);
	});

	it('claims before side effects and skips duplicate deliveries', async () => {
		const callOrder: string[] = [];
		mockClaimWebhookEvent
			.mockImplementationOnce(async () => {
				callOrder.push('claim');
				return true;
			})
			.mockImplementationOnce(async () => {
				callOrder.push('claim');
				return false;
			});
		mockHandleStripeWebhook.mockImplementation(async () => {
			callOrder.push('handle');
		});
		const POST = await loadPost();

		const firstResponse = await POST({
			request: new Request('http://localhost/api/webhooks/stripe', {
				method: 'POST',
				headers: { 'stripe-signature': 'sig' },
				body: '{}'
			})
		} as Parameters<typeof POST>[0]);

		const secondResponse = await POST({
			request: new Request('http://localhost/api/webhooks/stripe', {
				method: 'POST',
				headers: { 'stripe-signature': 'sig' },
				body: '{}'
			})
		} as Parameters<typeof POST>[0]);

		expect(firstResponse.status).toBe(200);
		expect(secondResponse.status).toBe(200);
		expect(callOrder).toEqual(['claim', 'handle', 'claim']);
		expect(mockHandleStripeWebhook).toHaveBeenCalledTimes(1);
		expect(mockRecordWebhookEvent).toHaveBeenCalledTimes(1);
	});

	it('marks a claimed event as failed when business logic throws', async () => {
		mockClaimWebhookEvent.mockResolvedValue(true);
		mockHandleStripeWebhook.mockRejectedValue(new Error('boom'));
		const POST = await loadPost();

		const response = await POST({
			request: new Request('http://localhost/api/webhooks/stripe', {
				method: 'POST',
				headers: { 'stripe-signature': 'sig' },
				body: '{}'
			})
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(400);
		expect(mockMarkWebhookEventFailed).toHaveBeenCalledWith('stripe', 'evt_stripe_1', 'boom');
	});

	it('does not execute side effects twice when persistence fails after side effects complete', async () => {
		mockClaimWebhookEvent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
		mockHandleStripeWebhook.mockResolvedValue(undefined);
		mockRecordWebhookEvent.mockRejectedValueOnce(new Error('persist failed'));
		const POST = await loadPost();

		const firstResponse = await POST({
			request: new Request('http://localhost/api/webhooks/stripe', {
				method: 'POST',
				headers: { 'stripe-signature': 'sig' },
				body: '{}'
			})
		} as Parameters<typeof POST>[0]);

		const secondResponse = await POST({
			request: new Request('http://localhost/api/webhooks/stripe', {
				method: 'POST',
				headers: { 'stripe-signature': 'sig' },
				body: '{}'
			})
		} as Parameters<typeof POST>[0]);

		expect(firstResponse.status).toBe(400);
		expect(secondResponse.status).toBe(200);
		expect(mockHandleStripeWebhook).toHaveBeenCalledTimes(1);
		expect(mockFinalizeWebhookEventProcessing).toHaveBeenCalledWith('stripe', 'evt_stripe_1');
		expect(mockMarkWebhookEventFailed).not.toHaveBeenCalled();
	});

	it('does not let bookkeeping failure mask the original webhook error', async () => {
		mockClaimWebhookEvent.mockResolvedValue(true);
		mockHandleStripeWebhook.mockRejectedValue(new Error('boom'));
		mockMarkWebhookEventFailed.mockRejectedValue(new Error('bookkeeping failed'));
		const POST = await loadPost();

		const response = await POST({
			request: new Request('http://localhost/api/webhooks/stripe', {
				method: 'POST',
				headers: { 'stripe-signature': 'sig' },
				body: '{}'
			})
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(400);
		expect(mockSendAdminAlert).toHaveBeenCalledWith(
			expect.objectContaining({
				message: 'Stripe webhook processing failed',
				details: expect.objectContaining({ error: 'boom' })
			})
		);
	});
});
