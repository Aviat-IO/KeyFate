import { beforeEach, describe, expect, it } from 'vitest';
import type { Subscription } from '$lib/payment/interfaces/PaymentProvider';
import {
	validateBTCPaySettledEntitlement,
	validateStripeCheckoutEntitlement
} from '$lib/payment/validate-entitlement';

const USER_ID = 'user-1';

function stripeSession(): Record<string, unknown> {
	return {
		id: 'cs_1',
		mode: 'subscription',
		customer: 'cus_1',
		subscription: 'sub_1',
		metadata: { user_id: USER_ID, plan_id: 'pro_monthly' }
	};
}

function stripeSubscription(priceId: string): Subscription {
	return {
		id: 'sub_1',
		customerId: 'cus_1',
		status: 'active',
		priceId,
		amount: 9,
		currency: 'USD',
		interval: 'month',
		currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
		currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
		cancelAtPeriodEnd: false,
		metadata: { user_id: USER_ID, plan_id: 'pro_monthly' }
	};
}

function btcpayInvoice(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: 'invoice-1',
		storeId: 'store-1',
		amount: '9',
		currency: 'USD',
		status: 'Settled',
		metadata: {
			user_id: USER_ID,
			plan_id: 'pro_monthly',
			expected_amount: '9',
			expected_currency: 'USD',
			billing_interval: 'month'
		},
		...overrides
	};
}

describe('payment entitlement validation', () => {
	beforeEach(() => {
		process.env.STRIPE_PRICE_ID_PRO_MONTHLY = 'price_allowed_monthly';
		process.env.STRIPE_PRICE_ID_PRO_YEARLY = 'price_allowed_yearly';
	});

	it('rejects Stripe checkout when the canonical subscription uses an unapproved price', () => {
		expect(() =>
			validateStripeCheckoutEntitlement(
				stripeSession(),
				stripeSubscription('price_unapproved'),
				USER_ID
			)
		).toThrow('Stripe subscription does not match an approved plan');
	});

	it('accepts Stripe entitlement only from the validated canonical subscription', () => {
		const plan = validateStripeCheckoutEntitlement(
			stripeSession(),
			stripeSubscription('price_allowed_monthly'),
			USER_ID
		);

		expect(plan).toMatchObject({
			id: 'pro_monthly',
			amount: 9,
			currency: 'USD',
			interval: 'month'
		});
	});

	it('rejects a settled BTCPay invoice whose canonical amount does not match the plan', () => {
		expect(() =>
			validateBTCPaySettledEntitlement(btcpayInvoice({ amount: '0.01' }), USER_ID)
		).toThrow('BTCPay invoice does not match the configured plan');
	});

	it('returns canonical accounting values for a validated BTCPay invoice', () => {
		const result = validateBTCPaySettledEntitlement(btcpayInvoice(), USER_ID);

		expect(result).toMatchObject({
			invoiceId: 'invoice-1',
			invoiceAmount: 9,
			plan: { id: 'pro_monthly', amount: 9, currency: 'USD', interval: 'month' }
		});
	});
});
