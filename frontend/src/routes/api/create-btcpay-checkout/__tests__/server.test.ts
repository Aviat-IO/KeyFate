import { beforeEach, describe, expect, it, vi } from 'vitest';

const createCustomer = vi.fn();
const createCheckoutSession = vi.fn();
const convertToProviderCurrency = vi.fn();

vi.mock('$env/dynamic/private', () => ({ env: {} }));

vi.mock('$lib/csrf', () => ({
	requireCSRFProtection: vi.fn(async () => ({ valid: true })),
	createCSRFErrorResponse: vi.fn(() => new Response(null, { status: 403 }))
}));

vi.mock('$lib/env', () => ({ SITE_URL: 'https://keyfate.example' }));

vi.mock('$lib/payment', () => ({
	getFiatPaymentProvider: vi.fn(),
	getCryptoPaymentProvider: () => ({
		createCustomer,
		createCheckoutSession,
		convertToProviderCurrency
	})
}));

vi.mock('$lib/pricing', () => ({
	getAmount: (period: 'monthly' | 'yearly') => (period === 'monthly' ? 9 : 90)
}));

const loadRoute = async () => import('../+server');

function eventFor(body: unknown) {
	return {
		request: new Request('https://keyfate.example/api/create-btcpay-checkout', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: {
			auth: vi.fn(async () => ({ user: { id: 'user-1', email: 'owner@example.com' } }))
		}
	};
}

describe('BTCPay checkout route', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		createCustomer.mockResolvedValue('btcpay_customer_1');
		createCheckoutSession.mockResolvedValue({ id: 'invoice-1', url: 'https://btcpay.example/i/1' });
	});

	it('does not expose a state-changing GET handler', async () => {
		const route = (await loadRoute()) as Record<string, unknown>;
		expect(route.GET).toBeUndefined();
	});

	it('rejects attacker-controlled amount and currency inputs', async () => {
		const route = await loadRoute();
		const response = await route.POST(
			eventFor({ plan: 'pro_monthly', amount: 1, currency: 'JPY' }) as never
		);

		expect(response.status).toBe(400);
		expect(createCustomer).not.toHaveBeenCalled();
	});

	it('creates an approved plan invoice in the canonical accounting currency', async () => {
		const route = await loadRoute();
		const response = await route.POST(eventFor({ plan: 'pro_monthly' }) as never);

		expect(response.status).toBe(200);
		expect(convertToProviderCurrency).not.toHaveBeenCalled();
		expect(createCheckoutSession).toHaveBeenCalledWith(
			expect.objectContaining({
				amount: 9,
				currency: 'USD',
				mode: 'subscription',
				metadata: expect.objectContaining({
					user_id: 'user-1',
					plan_id: 'pro_monthly',
					expected_amount: '9',
					expected_currency: 'USD',
					billing_interval: 'month'
				})
			})
		);
	});
});
