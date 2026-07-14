import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import {
	createRecoveryCapsule,
	createRecoveryManifest,
	RECOVERY_CAPSULE_VERSION
} from '$lib/nostr/recovery-capsule';
import { wrapCapsuleForRecipient } from '$lib/nostr/gift-wrap';

vi.mock('@sveltejs/kit', () => ({
	json: (data: unknown, init?: { status?: number }) =>
		new Response(JSON.stringify(data), {
			status: init?.status ?? 200,
			headers: { 'content-type': 'application/json' }
		})
}));

vi.mock('$lib/csrf', () => ({
	requireCSRFProtection: vi.fn(async () => ({ valid: true })),
	createCSRFErrorResponse: vi.fn(() => new Response(null, { status: 403 }))
}));

const requireSession = vi.fn(async () => ({ user: { id: 'user-1' } }));
vi.mock('$lib/server/auth', () => ({
	requireSession: () => requireSession()
}));

const updateWhere = vi.fn(async () => []);
const updateSet = vi.fn(() => ({ where: updateWhere }));
const update = vi.fn(() => ({ set: updateSet }));
const transaction = vi.fn(async (callback: (tx: { update: typeof update }) => Promise<void>) =>
	callback({ update })
);
const select = vi.fn();
const db = { select, transaction };
vi.mock('$lib/db/drizzle', () => ({ getDatabase: vi.fn(async () => db) }));

vi.mock('$lib/db/schema', () => ({
	secrets: {
		id: 'secrets.id',
		userId: 'secrets.user_id',
		status: 'secrets.status',
		checkInDays: 'secrets.check_in_days',
		nostrDeliveryStatus: 'secrets.nostr_delivery_status',
		bitcoinDeliveryStatus: 'secrets.bitcoin_delivery_status'
	},
	secretRecipients: {
		id: 'recipients.id',
		secretId: 'recipients.secret_id',
		nostrPubkey: 'recipients.nostr_pubkey'
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((left: unknown, right: unknown) => ({ type: 'eq', left, right })),
	and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions }))
}));

const relayPublish = vi.fn(async () => undefined);
vi.mock('$lib/nostr/client', () => ({
	createNostrClient: () => ({ publish: relayPublish, close: vi.fn() })
}));

const scheduleRemindersForSecret = vi.fn(async () => undefined);
vi.mock('$lib/services/reminder-scheduler', () => ({ scheduleRemindersForSecret }));

const SECRET_ID = '550e8400-e29b-41d4-a716-446655440000';
const RECIPIENT_ID = '660e8400-e29b-41d4-a716-446655440001';

function createRequest(body: unknown): Request {
	return new Request(`http://localhost/api/secrets/${SECRET_ID}/publish-nostr`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

function configureSelect(secretRows: unknown[], recipientRows: unknown[]) {
	let call = 0;
	select.mockImplementation(() => ({
		from: () => ({ where: async () => (call++ === 0 ? secretRows : recipientRows) })
	}));
}

function signedArtifacts() {
	const publisherSecretKey = generateSecretKey();
	const publisherPubkey = getPublicKey(publisherSecretKey);
	const recipientPubkey = getPublicKey(generateSecretKey());
	const capsule = createRecoveryCapsule(
		{
			version: RECOVERY_CAPSULE_VERSION,
			secretId: SECRET_ID,
			recipientId: RECIPIENT_ID,
			recipientNostrPubkey: recipientPubkey,
			shareIndex: 1,
			threshold: 2,
			totalShares: 3,
			encryptedShareHex: 'aabb',
			nonceHex: '00'.repeat(12),
			encryptedKNostr: 'opaque-nip44-payload'
		},
		publisherSecretKey
	);
	const giftWrapEvent = wrapCapsuleForRecipient(capsule, publisherSecretKey, recipientPubkey);
	const manifestEvent = createRecoveryManifest(
		{
			version: RECOVERY_CAPSULE_VERSION,
			secretId: SECRET_ID,
			recipientId: RECIPIENT_ID,
			recipientNostrPubkey: recipientPubkey,
			publisherPubkey,
			giftWrapEventId: giftWrapEvent.id,
			capsuleEventId: capsule.id
		},
		publisherSecretKey
	);
	return { recipientPubkey, giftWrapEvent, manifestEvent };
}

describe('POST /api/secrets/[id]/publish-nostr', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects the legacy plaintext-share request shape', async () => {
		const { POST } = await import('../+server');
		const response = await POST({
			params: { id: SECRET_ID },
			request: createRequest({
				shares: [{ recipientId: RECIPIENT_ID, share: 'plaintext-share', shareIndex: 1 }],
				threshold: 2,
				totalShares: 3
			})
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(400);
		expect(select).not.toHaveBeenCalled();
	});

	it.each(['plaintextK', 'passphrase', 'publisherSecretKey'])(
		'rejects the extra sensitive field %s before database access',
		async (field) => {
			const artifact = signedArtifacts();
			const { POST } = await import('../+server');
			const response = await POST({
				params: { id: SECRET_ID },
				request: createRequest({
					artifacts: [
						{
							giftWrapEvent: artifact.giftWrapEvent,
							manifestEvent: artifact.manifestEvent
						}
					],
					[field]: 'must-not-cross-boundary'
				})
			} as unknown as Parameters<typeof POST>[0]);

			expect(response.status).toBe(400);
			expect(select).not.toHaveBeenCalled();
		}
	);

	it('verifies, relays, and registers one opaque artifact per recipient', async () => {
		const artifact = signedArtifacts();
		configureSelect(
			[
				{
					id: SECRET_ID,
					status: 'paused',
					checkInDays: 30,
					nostrDeliveryStatus: 'pending',
					bitcoinDeliveryStatus: null
				}
			],
			[{ id: RECIPIENT_ID, nostrPubkey: artifact.recipientPubkey }]
		);

		const { POST } = await import('../+server');
		const response = await POST({
			params: { id: SECRET_ID },
			request: createRequest({
				artifacts: [
					{
						giftWrapEvent: artifact.giftWrapEvent,
						manifestEvent: artifact.manifestEvent
					}
				]
			})
		} as unknown as Parameters<typeof POST>[0]);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.active).toBe(true);
		expect(body.registered).toHaveLength(1);
		expect(relayPublish).toHaveBeenCalledWith(artifact.giftWrapEvent);
		expect(transaction).toHaveBeenCalledTimes(1);
		expect(scheduleRemindersForSecret).toHaveBeenCalledTimes(1);
	});

	it('rejects an outer event modified after signing', async () => {
		const artifact = signedArtifacts();
		configureSelect(
			[
				{
					id: SECRET_ID,
					status: 'paused',
					checkInDays: 30,
					nostrDeliveryStatus: 'pending',
					bitcoinDeliveryStatus: null
				}
			],
			[{ id: RECIPIENT_ID, nostrPubkey: artifact.recipientPubkey }]
		);

		const { POST } = await import('../+server');
		const response = await POST({
			params: { id: SECRET_ID },
			request: createRequest({
				artifacts: [
					{
						giftWrapEvent: { ...artifact.giftWrapEvent, content: 'modified' },
						manifestEvent: artifact.manifestEvent
					}
				]
			})
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(400);
		expect(transaction).not.toHaveBeenCalled();
	});
});
