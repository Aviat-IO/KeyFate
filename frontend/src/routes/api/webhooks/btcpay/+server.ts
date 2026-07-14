import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger } from '$lib/logger';
import { getCryptoPaymentProvider } from '$lib/payment';
import type { BTCPayInvoice, BTCPayProvider } from '$lib/payment/providers/BTCPayProvider';
import { serverEnv } from '$lib/server-env';
import { subscriptionService } from '$lib/services/subscription-service';
import { emailService } from '$lib/email/email-service';
import {
	claimWebhookEvent,
	finalizeWebhookEventProcessing,
	markWebhookEventFailed,
	recordWebhookEvent
} from '$lib/webhooks/deduplication';

export const POST: RequestHandler = async (event) => {
	let claimedEventId: string | null = null;
	let sideEffectsCompleted = false;

	try {
		const body = await event.request.text();
		const signature = event.request.headers.get('btcpay-sig');

		logger.info('BTCPay webhook received', {
			hasSignature: !!signature,
			bodyLength: body.length
		});

		if (!signature) {
			logger.error('BTCPay webhook missing signature header');
			return json({ error: 'No signature provided' }, { status: 400 });
		}

		// Check if webhook secret is configured
		if (!serverEnv.BTCPAY_WEBHOOK_SECRET) {
			logger.error('BTCPAY_WEBHOOK_SECRET not configured');
			return json({ error: 'Webhook secret not configured' }, { status: 500 });
		}

		const cryptoPaymentProvider = getCryptoPaymentProvider();

		// Verify webhook signature
		const webhookEvent = await cryptoPaymentProvider.verifyWebhookSignature(
			body,
			signature,
			serverEnv.BTCPAY_WEBHOOK_SECRET
		);

		logger.info('BTCPay webhook signature verified', {
			type: webhookEvent.type,
			id: webhookEvent.id
		});

		const rawEvent = JSON.parse(body) as {
			originalDeliveryId?: string;
			deliveryId?: string;
			invoiceId?: string;
			type?: string;
			metadata?: Record<string, unknown>;
		};
		const deduplicationKey = rawEvent.originalDeliveryId || webhookEvent.id;

		if (!deduplicationKey) {
			throw new Error('BTCPay webhook missing delivery identifier');
		}

		const claimed = await claimWebhookEvent(
			'btcpay',
			deduplicationKey,
			webhookEvent.type,
			webhookEvent
		);
		if (!claimed) {
			logger.info('BTCPay webhook already processed (replay detected)');
			return json({ received: true, duplicate: true });
		}
		claimedEventId = deduplicationKey;

		// BTCPay webhooks don't include full invoice data, just the ID
		// We need to fetch the invoice to get metadata
		const invoiceId = rawEvent.invoiceId;

		logger.debug('BTCPay webhook invoiceId', { invoiceId });

		// Detect test webhooks from BTCPay UI
		const isTestWebhook =
			invoiceId?.includes('__test__') ||
			rawEvent.originalDeliveryId?.includes('__test__') ||
			webhookEvent.type.includes('Test');

		if (isTestWebhook) {
			await recordWebhookEvent('btcpay', deduplicationKey, webhookEvent.type, webhookEvent);
			logger.info('Test webhook received and verified successfully');
			return json({
				received: true,
				test: true,
				message: 'Test webhook verified successfully'
			});
		}

		if (!invoiceId) {
			throw new Error('BTCPay invoice webhook missing invoiceId');
		}

		const provider = cryptoPaymentProvider as unknown as BTCPayProvider;
		const invoice = await provider.getInvoice(invoiceId);
		const canonicalEvent = {
			...webhookEvent,
			data: { object: invoice as unknown as Record<string, unknown> }
		};
		const userId = extractUserIdFromBTCPayInvoice(invoice);

		if (!userId) {
			logger.error('No user_id found in BTCPay webhook event metadata', undefined, {
				eventType: webhookEvent.type,
				eventId: webhookEvent.id || 'unknown'
			});
			await emailService.sendAdminAlert({
				type: 'webhook_failure',
				severity: 'medium',
				message: 'BTCPay webhook missing user_id',
				details: {
					eventType: webhookEvent.type,
					eventId: webhookEvent.id || 'unknown',
					provider: 'btcpay',
					eventData: webhookEvent.data
				}
			});
			await safelyMarkWebhookEventFailed('btcpay', deduplicationKey, 'No user_id in metadata');
			return json(
				{
					error: 'No user_id in metadata',
					eventType: webhookEvent.type,
					hint: 'user_id should be in invoice metadata'
				},
				{ status: 400 }
			);
		}

		// Handle entitlement from the canonical invoice, not the abbreviated webhook.
		await subscriptionService.handleBTCPayWebhook(canonicalEvent, userId);
		sideEffectsCompleted = true;

		await recordWebhookEvent('btcpay', deduplicationKey, webhookEvent.type, canonicalEvent);

		return json({ received: true });
	} catch (error) {
		if (claimedEventId && sideEffectsCompleted) {
			await safelyFinalizeWebhookEventProcessing('btcpay', claimedEventId);
		} else if (claimedEventId && !sideEffectsCompleted) {
			await safelyMarkWebhookEventFailed(
				'btcpay',
				claimedEventId,
				error instanceof Error ? error.message : 'Unknown error'
			);
		}

		logger.error('BTCPay webhook error', error instanceof Error ? error : undefined);

		// Send admin alert for webhook failures
		await emailService.sendAdminAlert({
			type: 'webhook_failure',
			severity: 'high',
			message: 'BTCPay webhook processing failed',
			details: {
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
				provider: 'btcpay',
				timestamp: new Date().toISOString()
			}
		});

		// Provide more specific error responses
		if (error instanceof Error && error.message.includes('Invalid webhook signature')) {
			return json({ error: 'Invalid webhook signature' }, { status: 401 });
		}

		if (error instanceof SyntaxError) {
			return json(
				{
					error: 'Invalid JSON payload'
				},
				{ status: 400 }
			);
		}

		return json({ error: 'Webhook processing failed' }, { status: 500 });
	}
};

async function safelyFinalizeWebhookEventProcessing(
	provider: 'stripe' | 'btcpay',
	eventId: string
): Promise<void> {
	try {
		await finalizeWebhookEventProcessing(provider, eventId);
	} catch (finalizationError) {
		logger.error(
			'Failed to persist webhook processed finalization',
			finalizationError instanceof Error ? finalizationError : undefined,
			{ provider, eventId }
		);
	}
}

async function safelyMarkWebhookEventFailed(
	provider: 'stripe' | 'btcpay',
	eventId: string,
	errorMessage: string
): Promise<void> {
	try {
		await markWebhookEventFailed(provider, eventId, errorMessage);
	} catch (bookkeepingError) {
		logger.error(
			'Failed to persist webhook failure bookkeeping',
			bookkeepingError instanceof Error ? bookkeepingError : undefined,
			{ provider, eventId }
		);
	}
}

function extractUserIdFromBTCPayInvoice(invoice: BTCPayInvoice): string | null {
	const userId = invoice.metadata?.user_id;
	return typeof userId === 'string' && userId.length > 0 ? userId : null;
}
