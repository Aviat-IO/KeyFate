import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { createAuthenticatedRecoverySet } from '$lib/crypto/recovery-v3';
import { publishSharesToNostr } from '$lib/services/nostr-publisher';
import { DEFAULT_RELAYS } from '$lib/nostr/relay-config';

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
vi.mock('$lib/server/auth', () => ({
	requireSession: vi.fn(async () => ({ user: { id: 'user-1' } }))
}));
let serviceEnvelope = '';
vi.mock('$lib/encryption', () => ({ decryptMessage: vi.fn(async () => serviceEnvelope) }));

let casSucceeds = true;
const returning = vi.fn(async () => (casSucceeds ? [{ id: RECIPIENT_ID }] : []));
const updateWhere = vi.fn(() => ({ returning }));
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
		nostrDeliveryStatus: 'secrets.nostr_delivery_status',
		sssThreshold: 'secrets.sss_threshold',
		sssSharesTotal: 'secrets.sss_shares_total',
		serverShare: 'secrets.server_share',
		iv: 'secrets.iv',
		authTag: 'secrets.auth_tag',
		keyVersion: 'secrets.key_version'
	},
	secretRecipients: {
		id: 'recipients.id',
		secretId: 'recipients.secret_id',
		nostrPubkey: 'recipients.nostr_pubkey',
		nostrPublisherPubkey: 'recipients.nostr_publisher_pubkey',
		nostrGiftWrapEventId: 'recipients.nostr_gift_wrap_event_id',
		nostrCapsuleEventId: 'recipients.nostr_capsule_event_id',
		nostrManifestEvent: 'recipients.nostr_manifest_event',
		nostrSchemeVersion: 'recipients.nostr_scheme_version'
	}
}));
vi.mock('drizzle-orm', () => ({
	eq: vi.fn((left: unknown, right: unknown) => ({ type: 'eq', left, right })),
	isNull: vi.fn((value: unknown) => ({ type: 'isNull', value })),
	and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
	or: vi.fn((...conditions: unknown[]) => ({ type: 'or', conditions }))
}));
const relayPublish = vi.fn(async () => undefined);
const relayClose = vi.fn();
const createRelayClient = vi.fn(() => ({
	publish: relayPublish,
	close: relayClose
}));
vi.mock('$lib/nostr/client', () => ({ createNostrClient: createRelayClient }));

const SECRET_ID = '550e8400-e29b-41d4-a716-446655440000';
const RECIPIENT_ID = '660e8400-e29b-41d4-a716-446655440001';
function createRequest(body: unknown): Request {
	return new Request(`http://localhost/api/secrets/${SECRET_ID}/publish-nostr`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}
function configureSelect(secretRows: readonly unknown[], recipientRows: readonly unknown[]) {
	let call = 0;
	select.mockImplementation(() => ({
		from: () => ({ where: async () => (call++ === 0 ? secretRows : recipientRows) })
	}));
}
async function signedArtifacts(secret = 'route test', relays: string[] = [DEFAULT_RELAYS[0]]) {
	const recipientKey = generateSecretKey();
	const recipientPubkey = getPublicKey(recipientKey);
	const set = createAuthenticatedRecoverySet(secret, { threshold: 2, total: 3 });
	const result = await publishSharesToNostr({
		secretId: SECRET_ID,
		shares: [{ recipientId: RECIPIENT_ID, share: set.envelopes[1], shareIndex: 2 }],
		recipients: [{ id: RECIPIENT_ID, nostrPubkey: recipientPubkey }],
		senderSecretKey: generateSecretKey(),
		threshold: 2,
		totalShares: 3,
		relays,
		client: { publish: async () => undefined, close: () => undefined }
	});
	const artifact = result.published[0];
	artifact.plaintextK.fill(0);
	recipientKey.fill(0);
	return { serviceEnvelope: set.envelopes[0], recipientPubkey, ...artifact };
}
function rowsFor(artifact: Awaited<ReturnType<typeof signedArtifacts>>) {
	return [
		{
			id: SECRET_ID,
			nostrDeliveryStatus: 'pending',
			sssThreshold: 2,
			sssSharesTotal: 3,
			serverShare: 'encrypted',
			iv: Buffer.from('123456789012').toString('base64'),
			authTag: Buffer.alloc(16).toString('base64'),
			keyVersion: 1
		},
		[
			{
				id: RECIPIENT_ID,
				nostrPubkey: artifact.recipientPubkey,
				nostrPublisherPubkey: null,
				nostrGiftWrapEventId: null,
				nostrCapsuleEventId: null,
				nostrManifestEvent: null,
				nostrSchemeVersion: null
			}
		]
	] as const;
}
function artifactBody(artifact: Awaited<ReturnType<typeof signedArtifacts>>) {
	return {
		artifacts: [
			{
				giftWrapEvent: artifact.giftWrapEvent,
				capsuleEvent: artifact.capsuleEvent,
				manifestEvent: artifact.manifestEvent
			}
		]
	};
}

describe('POST /api/secrets/[id]/publish-nostr v3', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		casSucceeds = true;
		relayPublish.mockImplementation(async () => undefined);
	});

	it('rejects plaintext or extra sensitive request fields before database access', async () => {
		const { POST } = await import('../+server');
		for (const body of [
			{ shares: [{ recipientId: RECIPIENT_ID, share: 'plaintext' }] },
			{ artifacts: [], plaintextK: 'forbidden' },
			{ artifacts: [], passphrase: 'forbidden' },
			{ artifacts: [], publisherSecretKey: 'forbidden' }
		]) {
			const response = await POST({
				params: { id: SECRET_ID },
				request: createRequest(body)
			} as unknown as Parameters<typeof POST>[0]);
			expect(response.status).toBe(400);
		}
		expect(select).not.toHaveBeenCalled();
	});

	it('binds artifacts to the stored service envelope and registers with CAS', async () => {
		const artifact = await signedArtifacts();
		serviceEnvelope = artifact.serviceEnvelope;
		const [secretRow, recipientRows] = rowsFor(artifact);
		configureSelect([secretRow], recipientRows);
		const { POST } = await import('../+server');
		const response = await POST({
			params: { id: SECRET_ID },
			request: createRequest(artifactBody(artifact))
		} as unknown as Parameters<typeof POST>[0]);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ status: 'registered', active: false });
		expect(createRelayClient).toHaveBeenCalledWith({ relays: [DEFAULT_RELAYS[0]] });
		expect(relayPublish).toHaveBeenCalledTimes(1);
		expect(transaction).toHaveBeenCalledTimes(1);
	});

	it('rejects a correctly signed artifact from a different recovery set', async () => {
		const stored = await signedArtifacts('stored set');
		const substituted = await signedArtifacts('substituted set');
		serviceEnvelope = stored.serviceEnvelope;
		const [secretRow, recipientRows] = rowsFor(substituted);
		configureSelect([secretRow], recipientRows);
		const { POST } = await import('../+server');
		const response = await POST({
			params: { id: SECRET_ID },
			request: createRequest(artifactBody(substituted))
		} as unknown as Parameters<typeof POST>[0]);
		expect(response.status).toBe(400);
		expect(transaction).not.toHaveBeenCalled();
	});

	it('rejects signed but unconfigured relay hints before server network access', async () => {
		const artifact = await signedArtifacts('unconfigured relay', ['wss://attacker.example']);
		serviceEnvelope = artifact.serviceEnvelope;
		const [secretRow, recipientRows] = rowsFor(artifact);
		configureSelect([secretRow], recipientRows);
		const { POST } = await import('../+server');
		const response = await POST({
			params: { id: SECRET_ID },
			request: createRequest(artifactBody(artifact))
		} as unknown as Parameters<typeof POST>[0]);
		expect(response.status).toBe(400);
		expect(createRelayClient).not.toHaveBeenCalled();
		expect(transaction).not.toHaveBeenCalled();
	});

	it('keeps enrollment pending when any server relay publication fails', async () => {
		const artifact = await signedArtifacts();
		serviceEnvelope = artifact.serviceEnvelope;
		const [secretRow, recipientRows] = rowsFor(artifact);
		configureSelect([secretRow], recipientRows);
		relayPublish.mockRejectedValueOnce(new Error('relay unavailable'));
		const { POST } = await import('../+server');
		const response = await POST({
			params: { id: SECRET_ID },
			request: createRequest(artifactBody(artifact))
		} as unknown as Parameters<typeof POST>[0]);
		expect(response.status).toBe(503);
		expect(transaction).not.toHaveBeenCalled();
	});

	it('rejects a racing replacement when compare-and-set loses', async () => {
		const artifact = await signedArtifacts();
		serviceEnvelope = artifact.serviceEnvelope;
		const [secretRow, recipientRows] = rowsFor(artifact);
		configureSelect([secretRow], recipientRows);
		casSucceeds = false;
		const { POST } = await import('../+server');
		const response = await POST({
			params: { id: SECRET_ID },
			request: createRequest(artifactBody(artifact))
		} as unknown as Parameters<typeof POST>[0]);
		expect(response.status).toBe(409);
	});
});
