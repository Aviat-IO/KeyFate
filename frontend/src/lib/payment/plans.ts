import { getAmount } from '$lib/pricing';

export const PAID_PLAN_IDS = ['pro_monthly', 'pro_yearly'] as const;
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

export interface PaidPlan {
	id: PaidPlanId;
	interval: 'month' | 'year';
	period: 'monthly' | 'yearly';
	amount: number;
	currency: 'USD';
}

export function isPaidPlanId(value: unknown): value is PaidPlanId {
	return typeof value === 'string' && PAID_PLAN_IDS.includes(value as PaidPlanId);
}

export function getStripePriceId(planId: PaidPlanId): string {
	const value =
		planId === 'pro_monthly'
			? process.env.STRIPE_PRICE_ID_PRO_MONTHLY
			: process.env.STRIPE_PRICE_ID_PRO_YEARLY;

	if (!value) {
		throw new Error(`Stripe price is not configured for ${planId}`);
	}

	return value;
}

export function getPaidPlan(planId: PaidPlanId): PaidPlan {
	const monthly = planId === 'pro_monthly';
	const period = monthly ? 'monthly' : 'yearly';

	return {
		id: planId,
		interval: monthly ? 'month' : 'year',
		period,
		amount: getAmount(period),
		currency: 'USD'
	};
}

export function findPaidPlanByStripePriceId(priceId: string): PaidPlan | null {
	for (const planId of PAID_PLAN_IDS) {
		try {
			const plan = getPaidPlan(planId);
			if (getStripePriceId(planId) === priceId) {
				return plan;
			}
		} catch {
			// Missing configuration cannot authorize a price.
		}
	}

	return null;
}
