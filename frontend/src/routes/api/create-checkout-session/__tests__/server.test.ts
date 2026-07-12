import { beforeEach, describe, expect, it, vi } from 'vitest';

const createCustomer = vi.fn();
const createCheckoutSession = vi.fn();
const listPrices = vi.fn();

vi.mock('$env/dynamic/private', () => ({ env: {} }));

vi.mock('$lib/server/auth', () => ({ requireSession: vi.fn() }));

vi.mock('$lib/csrf', () => ({
	requireCSRFProtection: vi.fn(async () => ({ valid: true })),
	createCSRFErrorResponse: vi.fn(() => new Response(null, { status: 403 }))
}));

vi.mock('$lib/env', () => ({ SITE_URL: 'https://keyfate.example' }));

vi.mock('$lib/payment', () => ({
	getFiatPaymentProvider: () => ({ createCustomer, createCheckoutSession, listPrices }),
	getCryptoPaymentProvider: vi.fn()
}));

const loadRoute = async () => import('../+server');

function eventFor(body: unknown) {
	return {
		request: new Request('https://keyfate.example/api/create-checkout-session', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: {
			auth: vi.fn(async () => ({ user: { id: 'user-1', email: 'owner@example.com' } }))
		}
	};
}

describe('checkout session route', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.STRIPE_PRICE_ID_PRO_MONTHLY = 'price_allowed_monthly';
		process.env.STRIPE_PRICE_ID_PRO_YEARLY = 'price_allowed_yearly';
		createCustomer.mockResolvedValue('cus_1');
		createCheckoutSession.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.example/cs_1' });
	});

	it('does not expose a state-changing GET handler', async () => {
		const route = (await loadRoute()) as Record<string, unknown>;
		expect(route.GET).toBeUndefined();
	});

	it('rejects a client-supplied Stripe lookup key before provider side effects', async () => {
		const route = await loadRoute();
		const response = await route.POST(eventFor({ lookup_key: 'cheap_unrelated_price' }) as never);

		expect(response.status).toBe(400);
		expect(createCustomer).not.toHaveBeenCalled();
		expect(createCheckoutSession).not.toHaveBeenCalled();
	});

	it('maps an approved plan to the exact configured Stripe price', async () => {
		const route = await loadRoute();
		const response = await route.POST(eventFor({ plan: 'pro_monthly' }) as never);

		expect(response.status).toBe(200);
		expect(listPrices).not.toHaveBeenCalled();
		expect(createCheckoutSession).toHaveBeenCalledWith(
			expect.objectContaining({
				priceId: 'price_allowed_monthly',
				mode: 'subscription',
				metadata: expect.objectContaining({ user_id: 'user-1', plan_id: 'pro_monthly' })
			})
		);
	});
});
