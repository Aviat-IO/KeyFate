import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockVerifyWebhookSignature = vi.fn();
const mockGetInvoice = vi.fn();
const mockHandleBTCPayWebhook = vi.fn();
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
		BTCPAY_WEBHOOK_SECRET: 'btcpay_secret'
	}
}));

vi.mock('$lib/payment', () => ({
	getFiatPaymentProvider: vi.fn(),
	getCryptoPaymentProvider: () => ({
		verifyWebhookSignature: mockVerifyWebhookSignature,
		getInvoice: mockGetInvoice
	})
}));

vi.mock('$lib/server-env', () => ({
	serverEnv: {
		BTCPAY_WEBHOOK_SECRET: 'btcpay_secret'
	}
}));

vi.mock('$lib/services/subscription-service', () => ({
	subscriptionService: {
		handleBTCPayWebhook: mockHandleBTCPayWebhook
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

vi.mock('$lib/logger', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn()
	}
}));

const loadPost = async () => (await import('../+server')).POST;

const btcpayWebhookEvent = {
	id: 'delivery-2',
	type: 'InvoiceSettled',
	data: {
		object: {}
	}
};

const btcpayBody = JSON.stringify({
	originalDeliveryId: 'delivery-1',
	deliveryId: 'delivery-2',
	invoiceId: 'invoice-123',
	type: 'InvoiceSettled'
});

describe('POST /api/webhooks/btcpay', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockVerifyWebhookSignature.mockResolvedValue(btcpayWebhookEvent);
		mockGetInvoice.mockResolvedValue({
			metadata: { user_id: 'user-123' }
		});
		mockRecordWebhookEvent.mockResolvedValue(true);
		mockFinalizeWebhookEventProcessing.mockResolvedValue(true);
		mockMarkWebhookEventFailed.mockResolvedValue(true);
		mockSendAdminAlert.mockResolvedValue(undefined);
	});

	it('claims with original delivery id before side effects and skips duplicates', async () => {
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
		mockHandleBTCPayWebhook.mockImplementation(async () => {
			callOrder.push('handle');
		});
		const POST = await loadPost();

		const firstResponse = await POST({
			request: new Request('http://localhost/api/webhooks/btcpay', {
				method: 'POST',
				headers: { 'btcpay-sig': 'sig' },
				body: btcpayBody
			})
		} as Parameters<typeof POST>[0]);

		const secondResponse = await POST({
			request: new Request('http://localhost/api/webhooks/btcpay', {
				method: 'POST',
				headers: { 'btcpay-sig': 'sig' },
				body: btcpayBody
			})
		} as Parameters<typeof POST>[0]);

		expect(firstResponse.status).toBe(200);
		expect(secondResponse.status).toBe(200);
		expect(callOrder).toEqual(['claim', 'handle', 'claim']);
		expect(mockClaimWebhookEvent).toHaveBeenNthCalledWith(
			1,
			'btcpay',
			'delivery-1',
			'InvoiceSettled',
			btcpayWebhookEvent
		);
		expect(mockHandleBTCPayWebhook).toHaveBeenCalledTimes(1);
		expect(mockRecordWebhookEvent).toHaveBeenCalledTimes(1);
	});

	it('marks a claimed BTCPay event as failed when business logic throws', async () => {
		mockClaimWebhookEvent.mockResolvedValue(true);
		mockHandleBTCPayWebhook.mockRejectedValue(new Error('boom'));
		const POST = await loadPost();

		const response = await POST({
			request: new Request('http://localhost/api/webhooks/btcpay', {
				method: 'POST',
				headers: { 'btcpay-sig': 'sig' },
				body: btcpayBody
			})
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(500);
		expect(mockMarkWebhookEventFailed).toHaveBeenCalledWith('btcpay', 'delivery-1', 'boom');
	});

	it('attempts explicit processed finalization when recording fails after side effects', async () => {
		mockClaimWebhookEvent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
		mockHandleBTCPayWebhook.mockResolvedValue(undefined);
		mockRecordWebhookEvent.mockRejectedValueOnce(new Error('persist failed'));
		const POST = await loadPost();

		const firstResponse = await POST({
			request: new Request('http://localhost/api/webhooks/btcpay', {
				method: 'POST',
				headers: { 'btcpay-sig': 'sig' },
				body: btcpayBody
			})
		} as Parameters<typeof POST>[0]);

		const secondResponse = await POST({
			request: new Request('http://localhost/api/webhooks/btcpay', {
				method: 'POST',
				headers: { 'btcpay-sig': 'sig' },
				body: btcpayBody
			})
		} as Parameters<typeof POST>[0]);

		expect(firstResponse.status).toBe(500);
		expect(secondResponse.status).toBe(200);
		expect(mockHandleBTCPayWebhook).toHaveBeenCalledTimes(1);
		expect(mockFinalizeWebhookEventProcessing).toHaveBeenCalledWith('btcpay', 'delivery-1');
		expect(mockMarkWebhookEventFailed).not.toHaveBeenCalled();
	});
});
