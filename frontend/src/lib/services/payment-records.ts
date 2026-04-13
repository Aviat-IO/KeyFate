/**
 * Payment Record Management
 *
 * Functions for creating and querying payment history records.
 * Extracted from subscription-service.ts for maintainability.
 */

import { getDatabase } from '$lib/db/drizzle';
import { paymentHistory } from '$lib/db/schema';
import { logSubscriptionChanged } from '$lib/services/audit-logger';
import { and, eq } from 'drizzle-orm';
import { logger } from '$lib/logger';
import type { SubscriptionProvider } from './subscription-service.types';

export interface CreatePaymentRecordData {
	userId: string;
	subscriptionId?: string;
	provider: SubscriptionProvider;
	providerPaymentId: string;
	amount: number;
	currency?: string;
	status: 'succeeded' | 'failed' | 'pending' | 'refunded';
	failureReason?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Insert a payment record and log the event to the audit trail.
 */
export async function createPaymentRecord(data: CreatePaymentRecordData) {
	const db = await getDatabase();
	try {
		const existingPayment = await getPaymentRecordByProviderPaymentId(
			data.provider,
			data.providerPaymentId
		);

		if (existingPayment) {
			logger.info('Skipping duplicate payment record replay', {
				provider: data.provider,
				providerPaymentId: data.providerPaymentId,
				userId: data.userId
			});
			return existingPayment;
		}

		const insertValues: typeof paymentHistory.$inferInsert = {
			userId: data.userId,
			subscriptionId: data.subscriptionId || null,
			provider: data.provider,
			providerPaymentId: data.providerPaymentId,
			amount: data.amount.toString(),
			currency: data.currency || 'USD',
			status: data.status,
			failureReason: data.failureReason || null,
			metadata: data.metadata || null,
			createdAt: new Date(),
			updatedAt: new Date()
		};
		const [payment] = await db
			.insert(paymentHistory)
			.values(insertValues)
			.onConflictDoNothing()
			.returning();

		if (!payment) {
			const duplicatePayment = await getPaymentRecordByProviderPaymentId(
				data.provider,
				data.providerPaymentId
			);

			if (duplicatePayment) {
				return duplicatePayment;
			}
			throw new Error('Payment insert conflicted but existing payment record was not found');
		}

		await logSubscriptionChanged(data.userId, {
			action: 'payment_processed',
			provider: data.provider,
			amount: data.amount,
			status: data.status,
			paymentId: data.providerPaymentId,
			resourceType: 'payment',
			resourceId: `${data.provider}:${data.providerPaymentId}`
		});

		return payment;
	} catch (error) {
		logger.error('Failed to create payment record', error instanceof Error ? error : undefined, {
			provider: data.provider,
			status: data.status
		});
		throw error;
	}
}

async function getPaymentRecordByProviderPaymentId(
	provider: SubscriptionProvider,
	providerPaymentId: string
) {
	const db = await getDatabase();
	const [payment] = await db
		.select()
		.from(paymentHistory)
		.where(
			and(
				eq(paymentHistory.provider, provider),
				eq(paymentHistory.providerPaymentId, providerPaymentId)
			)
		)
		.limit(1);

	return payment || null;
}
