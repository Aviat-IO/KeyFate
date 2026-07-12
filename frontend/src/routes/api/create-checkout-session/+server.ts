import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireCSRFProtection, createCSRFErrorResponse } from '$lib/csrf';
import { SITE_URL } from '$lib/env';
import { logger } from '$lib/logger';
import { getFiatPaymentProvider } from '$lib/payment';
import { getPaidPlan, getStripePriceId, PAID_PLAN_IDS } from '$lib/payment/plans';
import { z } from 'zod';

const checkoutRequestSchema = z
	.object({
		plan: z.enum(PAID_PLAN_IDS)
	})
	.strict();

/**
 * Create a Stripe checkout session for one server-owned paid plan.
 * Checkout creation is intentionally POST-only.
 */
export const POST: RequestHandler = async (event) => {
	try {
		const csrfCheck = await requireCSRFProtection(event);
		if (!csrfCheck.valid) {
			return createCSRFErrorResponse();
		}

		const parsed = checkoutRequestSchema.safeParse(await event.request.json());
		if (!parsed.success) {
			return json({ error: 'Invalid checkout plan' }, { status: 400 });
		}

		const plan = getPaidPlan(parsed.data.plan);
		const priceId = getStripePriceId(plan.id);
		const session = await event.locals.auth();
		const user = session?.user;
		if (!user?.email || !user.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const provider = getFiatPaymentProvider();
		const customerId = await provider.createCustomer(user.email, {
			user_id: user.id
		});
		const checkoutSession = await provider.createCheckoutSession({
			customerId,
			priceId,
			mode: 'subscription',
			successUrl: `${SITE_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${SITE_URL}/pricing?canceled=true`,
			billingAddressCollection: 'auto',
			automaticTax: { enabled: false },
			locale: 'en',
			metadata: {
				user_id: user.id,
				plan_id: plan.id,
				expected_price_id: priceId,
				expected_amount: String(plan.amount),
				expected_currency: plan.currency,
				billing_interval: plan.interval
			}
		});

		logger.info('Stripe checkout session created', {
			userId: user.id,
			planId: plan.id,
			sessionId: checkoutSession.id
		});

		return json({
			url: checkoutSession.url,
			sessionId: checkoutSession.id
		});
	} catch (error) {
		logger.error(
			'Failed to create Stripe checkout session',
			error instanceof Error ? error : undefined
		);
		return json({ error: 'Checkout is temporarily unavailable' }, { status: 503 });
	}
};
