import { getDatabase } from '$lib/db/drizzle';
import { webhookEvents } from '$lib/db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { logger } from '$lib/logger';

const STALE_WEBHOOK_PROCESSING_MS = 5 * 60 * 1000;

export async function claimWebhookEvent(
	provider: 'stripe' | 'btcpay',
	eventId: string,
	eventType: string,
	payload: unknown
): Promise<boolean> {
	try {
		const db = await getDatabase();
		const now = new Date();
		const staleProcessingCutoff = new Date(now.getTime() - STALE_WEBHOOK_PROCESSING_MS);

		const [claimed] = await db
			.insert(webhookEvents)
			.values({
				provider,
				eventId,
				eventType,
				payload: payload as Record<string, unknown>,
				status: 'processing',
				processedAt: null,
				errorMessage: null,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: [webhookEvents.provider, webhookEvents.eventId],
				set: {
					eventType,
					payload: payload as Record<string, unknown>,
					status: 'processing',
					processedAt: null,
					errorMessage: null,
					retryCount: sql`${webhookEvents.retryCount} + 1`,
					updatedAt: now
				},
				setWhere: sql`${webhookEvents.status} = 'failed' or (${webhookEvents.status} = 'processing' and ${webhookEvents.updatedAt} < ${staleProcessingCutoff})`
			})
			.returning({ id: webhookEvents.id });

		if (!claimed) {
			logger.info('Webhook already claimed (duplicate)', {
				provider,
				eventId
			});
			return false;
		}

		return true;
	} catch (error) {
		logger.error('Failed to claim webhook event', error as Error, {
			provider,
			eventId
		});
		throw error;
	}
}

export async function isWebhookProcessed(
	provider: 'stripe' | 'btcpay',
	eventId: string
): Promise<boolean> {
	try {
		const db = await getDatabase();

		const existing = await db
			.select()
			.from(webhookEvents)
			.where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)))
			.limit(1);

		return existing.length > 0;
	} catch (error) {
		logger.error('Failed to check webhook deduplication', error as Error, {
			provider,
			eventId
		});
		return false;
	}
}

export async function recordWebhookEvent(
	provider: 'stripe' | 'btcpay',
	eventId: string,
	eventType: string,
	payload: unknown
): Promise<boolean> {
	void eventType;
	void payload;

	try {
		const db = await getDatabase();

		const [updated] = await db
			.update(webhookEvents)
			.set({
				status: 'processed',
				processedAt: new Date(),
				errorMessage: null,
				updatedAt: new Date()
			})
			.where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)))
			.returning({ id: webhookEvents.id });

		return !!updated;
	} catch (error) {
		logger.error('Failed to record webhook event', error as Error, {
			provider,
			eventId
		});
		throw error;
	}
}

export async function finalizeWebhookEventProcessing(
	provider: 'stripe' | 'btcpay',
	eventId: string
): Promise<boolean> {
	try {
		const db = await getDatabase();

		const [updated] = await db
			.update(webhookEvents)
			.set({
				status: 'processed',
				processedAt: new Date(),
				errorMessage: null,
				updatedAt: new Date()
			})
			.where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)))
			.returning({ id: webhookEvents.id });

		return !!updated;
	} catch (error) {
		logger.error('Failed to finalize webhook event processing', error as Error, {
			provider,
			eventId
		});
		throw error;
	}
}

export async function markWebhookEventFailed(
	provider: 'stripe' | 'btcpay',
	eventId: string,
	errorMessage: string
): Promise<boolean> {
	try {
		const db = await getDatabase();

		const [updated] = await db
			.update(webhookEvents)
			.set({
				status: 'failed',
				errorMessage,
				updatedAt: new Date()
			})
			.where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)))
			.returning({ id: webhookEvents.id });

		return !!updated;
	} catch (error) {
		logger.error('Failed to mark webhook event as failed', error as Error, {
			provider,
			eventId
		});
		throw error;
	}
}

export async function cleanupOldWebhookEvents(daysToKeep: number = 30): Promise<number> {
	try {
		const db = await getDatabase();
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

		const result = await db
			.delete(webhookEvents)
			.where(lt(webhookEvents.createdAt, cutoffDate))
			.returning({ id: webhookEvents.id });

		logger.info('Cleaned up old webhook events', {
			daysToKeep,
			cutoffDate: cutoffDate.toISOString(),
			deletedCount: result.length
		});

		return result.length;
	} catch (error) {
		logger.error('Failed to cleanup webhook events', error as Error);
		return 0;
	}
}
