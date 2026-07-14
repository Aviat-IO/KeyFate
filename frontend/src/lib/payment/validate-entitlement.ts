import type { Subscription as ProviderSubscription } from './interfaces/PaymentProvider';
import { findPaidPlanByStripePriceId, getPaidPlan, isPaidPlanId, type PaidPlan } from './plans';

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function validateStripeCheckoutEntitlement(
	session: Record<string, unknown>,
	canonicalSubscription: ProviderSubscription,
	userId: string
): PaidPlan {
	const subscription = session.subscription;
	const subscriptionId =
		typeof subscription === 'string' ? subscription : asRecord(subscription).id;
	if (typeof subscriptionId !== 'string' || subscriptionId.length === 0) {
		throw new Error('Stripe checkout is missing a subscription');
	}

	const plan = canonicalSubscription.priceId
		? findPaidPlanByStripePriceId(canonicalSubscription.priceId)
		: null;
	const sessionMetadata = asRecord(session.metadata);
	const subscriptionMetadata = asRecord(canonicalSubscription.metadata);
	const matchesPlan =
		plan !== null &&
		canonicalSubscription.id === subscriptionId &&
		canonicalSubscription.customerId === session.customer &&
		canonicalSubscription.amount === plan.amount &&
		canonicalSubscription.currency?.toUpperCase() === plan.currency &&
		canonicalSubscription.interval === plan.interval &&
		sessionMetadata.user_id === userId &&
		sessionMetadata.plan_id === plan.id &&
		subscriptionMetadata.user_id === userId &&
		subscriptionMetadata.plan_id === plan.id;

	if (!matchesPlan || !plan) {
		throw new Error('Stripe subscription does not match an approved plan');
	}

	return plan;
}

export function validateBTCPaySettledEntitlement(
	invoice: Record<string, unknown>,
	userId: string
): { invoiceId: string; invoiceAmount: number; plan: PaidPlan } {
	const metadata = asRecord(invoice.metadata);
	const planId = metadata.plan_id;
	if (!isPaidPlanId(planId)) {
		throw new Error('BTCPay invoice is missing an approved plan');
	}

	const plan = getPaidPlan(planId);
	const invoiceAmount = Number(invoice.amount);
	const invoiceCurrency = String(invoice.currency || '').toUpperCase();
	const invoiceStatus = String(invoice.status || '').toLowerCase();
	const expectedAmount = Number(metadata.expected_amount);
	const expectedCurrency = String(metadata.expected_currency || '').toUpperCase();
	const billingInterval = String(metadata.billing_interval || '');
	const matchesPlan =
		Number.isFinite(invoiceAmount) &&
		invoiceAmount === plan.amount &&
		expectedAmount === plan.amount &&
		invoiceCurrency === plan.currency &&
		expectedCurrency === plan.currency &&
		billingInterval === plan.interval &&
		metadata.user_id === userId &&
		invoiceStatus === 'settled';

	if (!matchesPlan || typeof invoice.id !== 'string' || invoice.id.length === 0) {
		throw new Error('BTCPay invoice does not match the configured plan');
	}

	return { invoiceId: invoice.id, invoiceAmount, plan };
}
