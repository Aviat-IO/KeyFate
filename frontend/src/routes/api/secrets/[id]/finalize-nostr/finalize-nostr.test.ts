import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { RECOVERY_V3_SCHEME } from '$lib/crypto/recovery-v3';
import { createRecoveryManifestV3 } from '$lib/nostr/recovery-v3-artifact';

vi.mock('@sveltejs/kit', () => ({
	json: (data: unknown, init?: { status?: number }) =>
		new Response(JSON.stringify(data), {
			status: init?.status ?? 200,
			headers: { 'content-type': 'application/json' }
		})
}));
const csrf = vi.fn(async () => ({ valid: true }));
vi.mock('$lib/csrf', () => ({
	requireCSRFProtection: csrf,
	createCSRFErrorResponse: vi.fn(() => new Response(null, { status: 403 }))
}));
vi.mock('$lib/server/auth', () => ({
	requireSession: vi.fn(async () => ({ user: { id: 'owner' } }))
}));
vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => ({})),
	and: vi.fn(() => ({})),
	or: vi.fn(() => ({})),
	isNull: vi.fn(() => ({}))
}));
vi.mock('$lib/db/schema', () => ({
	secrets: {
		id: 'id',
		userId: 'userId',
		status: 'status',
		nostrDeliveryStatus: 'nostrStatus',
		bitcoinDeliveryStatus: 'bitcoinStatus',
		checkInDays: 'days',
		nextCheckIn: 'next'
	},
	secretRecipients: {
		id: 'rid',
		secretId: 'sid',
		nostrPubkey: 'npub',
		nostrSchemeVersion: 'version',
		nostrPublisherPubkey: 'publisher',
		nostrGiftWrapEventId: 'gift',
		nostrCapsuleEventId: 'capsule',
		nostrManifestEvent: 'manifest'
	},
	reminderJobs: {
		secretId: 'reminderSecretId',
		status: 'reminderStatus',
		reminderType: 'reminderType',
		scheduledFor: 'scheduledFor'
	}
}));
vi.mock('$lib/services/reminder-scheduler', () => ({
	getApplicableReminderTypes: vi.fn(() => ['1_hour']),
	calculateScheduledFor: vi.fn(
		(_type: string, nextCheckIn: Date) => new Date(nextCheckIn.getTime() - 60 * 60 * 1000)
	)
}));

let secretRows: Array<Record<string, unknown>> = [];
let recipientRows: Array<Record<string, unknown>> = [];
let transitionFails = false;
let insertionFails = false;
const topSelect = vi.fn(() => {
	const rows = topSelect.mock.calls.length % 2 === 1 ? secretRows : recipientRows;
	return { from: () => ({ where: async () => rows }) };
});
const txSelect = vi.fn(() => ({
	from: () => ({ where: () => ({ for: async () => secretRows }) })
}));
const txUpdate = vi.fn(() => ({
	set: () => ({
		where: () => ({ returning: async () => (transitionFails ? [] : [{ id: SECRET_ID }]) })
	})
}));
const txInsert = vi.fn(() => ({
	values: () => ({
		onConflictDoNothing: async () => {
			if (insertionFails) throw new Error('reminder insert failed');
		}
	})
}));
const transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
	callback({ select: txSelect, update: txUpdate, insert: txInsert })
);
vi.mock('$lib/db/drizzle', () => ({
	getDatabase: vi.fn(async () => ({ select: topSelect, transaction }))
}));

const SECRET_ID = '11111111-1111-4111-8111-111111111111';
const RECIPIENT_ID = '22222222-2222-4222-8222-222222222222';
const RECIPIENT_PUBKEY = 'a'.repeat(64);
function requestEvent() {
	return {
		params: { id: SECRET_ID },
		request: new Request(`http://localhost/api/secrets/${SECRET_ID}/finalize-nostr`, {
			method: 'POST'
		})
	};
}

describe('Nostr v3 finalization', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		transitionFails = false;
		insertionFails = false;
		const publisherKey = generateSecretKey();
		const publisherPubkey = getPublicKey(publisherKey);
		const giftWrapEventId = 'c'.repeat(64);
		const capsuleEventId = 'd'.repeat(64);
		const manifestEvent = createRecoveryManifestV3(
			{
				scheme: RECOVERY_V3_SCHEME,
				version: 3,
				secretId: SECRET_ID,
				recipientId: RECIPIENT_ID,
				recipientNostrPubkey: RECIPIENT_PUBKEY,
				publisherPubkey,
				setId: 'e'.repeat(32),
				threshold: 2,
				totalShares: 3,
				shareIndex: 2,
				ciphertextDigestHex: 'f'.repeat(64),
				giftWrapEventId,
				capsuleEventId,
				relayHints: ['wss://relay.example']
			},
			publisherKey
		);
		publisherKey.fill(0);
		secretRows = [
			{
				id: SECRET_ID,
				status: 'paused',
				nostrDeliveryStatus: 'registered',
				bitcoinDeliveryStatus: null,
				checkInDays: 30,
				nextCheckIn: new Date()
			}
		];
		recipientRows = [
			{
				id: RECIPIENT_ID,
				nostrPubkey: RECIPIENT_PUBKEY,
				nostrSchemeVersion: 3,
				nostrPublisherPubkey: publisherPubkey,
				nostrGiftWrapEventId: giftWrapEventId,
				nostrCapsuleEventId: capsuleEventId,
				nostrManifestEvent: manifestEvent
			}
		];
	});

	it('atomically inserts reminders and transitions readiness once', async () => {
		const { POST } = await import('./+server');
		const response = await POST(requestEvent() as unknown as Parameters<typeof POST>[0]);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			status: 'ready',
			active: true,
			idempotent: false
		});
		expect(txInsert).toHaveBeenCalledTimes(1);
		expect(transaction).toHaveBeenCalledTimes(1);
	});

	it('is idempotent after ready and never schedules again', async () => {
		secretRows = [
			{
				id: SECRET_ID,
				status: 'active',
				nostrDeliveryStatus: 'ready',
				bitcoinDeliveryStatus: null,
				checkInDays: 30,
				nextCheckIn: new Date()
			}
		];
		const { POST } = await import('./+server');
		const response = await POST(requestEvent() as unknown as Parameters<typeof POST>[0]);
		expect(await response.json()).toMatchObject({ idempotent: true, active: true });
		expect(txInsert).not.toHaveBeenCalled();
	});

	it('rolls back readiness when reminder insertion fails', async () => {
		insertionFails = true;
		const { POST } = await import('./+server');
		const response = await POST(requestEvent() as unknown as Parameters<typeof POST>[0]);
		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({ error: 'reminder insert failed' });
	});

	it('refuses pending or incomplete enrollment', async () => {
		secretRows = [
			{
				id: SECRET_ID,
				status: 'paused',
				nostrDeliveryStatus: 'pending',
				bitcoinDeliveryStatus: null,
				checkInDays: 30,
				nextCheckIn: new Date()
			}
		];
		const { POST } = await import('./+server');
		const response = await POST(requestEvent() as unknown as Parameters<typeof POST>[0]);
		expect(response.status).toBe(409);
		expect(transaction).not.toHaveBeenCalled();
	});
});
