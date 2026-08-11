/**
 * Recovery flow orchestration for the recipient recovery UI.
 *
 * Provides testable, pure-logic functions for each recovery path:
 * 1. Nostr gift-wrap unwrapping and share extraction
 * 2. Bitcoin OP_RETURN parsing and K extraction
 * 3. Passphrase-based K recovery
 *
 * These functions are decoupled from the UI so they can be unit-tested.
 */

import { getConversationKey, decrypt as nip44Decrypt } from '$lib/nostr/encryption';
import type { Event as NostrEvent } from 'nostr-tools/core';
import type { BitcoinNetwork } from '$lib/bitcoin/network';
import * as nip19 from 'nostr-tools/nip19';
import { getEventHash, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import { z } from 'zod';
import { recoverKFromOpReturn, decryptShare } from '$lib/crypto/recovery';
import { deriveKeyFromPassphrase, decryptWithDerivedKey } from '$lib/crypto/passphrase';
import { hexToBytes, bytesToHex } from './hex-utils';
import { KEYFATE_SHARE_KIND } from '$lib/nostr/gift-wrap';
import {
	parseNostrEvent,
	parseVerifiedCapsule,
	parseVerifiedManifest,
	RECOVERY_CAPSULE_VERSION
} from '$lib/nostr/recovery-capsule';
import { decryptBitcoinRecoveryEnvelope } from '$lib/bitcoin/recovery-envelope';
import { validateBitcoinRecoveryTransaction } from '$lib/bitcoin/validate-recovery-tx';
import {
	NOSTR_RECOVERY_V3_VERSION,
	parseVerifiedCapsuleV3,
	parseVerifiedManifestV3
} from '$lib/nostr/recovery-v3-artifact';
import { validateRecoveryShareEnvelopeContext } from '$lib/crypto/recovery-v3';
// Re-export so existing consumers (components, tests) don't break
export { hexToBytes, bytesToHex };

// ─── Types ───────────────────────────────────────────────────────────────────

/** Verified plaintext share recovered from a v2 gift-wrapped capsule. */
export interface UnwrappedShare {
	/** The decrypted Shamir share */
	share: string;
	/** KeyFate secret ID */
	secretId: string;
	/** 1-based share index */
	shareIndex: number;
	/** Minimum shares needed to reconstruct */
	threshold: number;
	/** Total number of shares */
	totalShares: number;
	/** Schema version */
	version: number;
}

/** A gift-wrapped event with metadata for display. */
export interface FoundGiftWrap {
	/** The raw Nostr event */
	event: NostrEvent;
	/** Timestamp of the gift wrap */
	createdAt: number;
	/** Ephemeral pubkey of the gift wrap */
	senderPubkey: string;
}

/** Result of parsing a Bitcoin transaction for OP_RETURN data. */
export interface OpReturnData {
	/** The 32-byte symmetric key K */
	symmetricKeyK: Uint8Array;
	/** The 32-byte Nostr event ID (hex) */
	nostrEventId: string;
}

/** A fully decrypted share ready for display. */
export interface DecryptedShareResult {
	/** The plaintext share data */
	share: string;
	/** Share index (1-based) */
	shareIndex: number;
	/** Threshold needed */
	threshold: number;
	/** Total shares */
	totalShares: number;
	/** Secret ID */
	secretId: string;
}

// ─── Nostr Recovery ──────────────────────────────────────────────────────────

/**
 * Decode an nsec string to a raw secret key (Uint8Array).
 *
 * @throws If the input is not a valid nsec
 */
export function nsecToSecretKey(nsec: string): Uint8Array {
	const decoded = nip19.decode(nsec.trim());
	if (decoded.type !== 'nsec') {
		throw new Error(`Expected nsec, got ${decoded.type}`);
	}
	return decoded.data;
}

/**
 * Validate that a string is a well-formed nsec.
 */
export function isValidNsec(value: string): boolean {
	try {
		nsecToSecretKey(value);
		return true;
	} catch {
		return false;
	}
}

const signedEventSchema = z
	.object({
		id: z.string().regex(/^[0-9a-f]{64}$/),
		pubkey: z.string().regex(/^[0-9a-f]{64}$/),
		created_at: z.number().int().nonnegative(),
		kind: z.number().int().nonnegative(),
		tags: z.array(z.array(z.string())),
		content: z.string(),
		sig: z.string().regex(/^[0-9a-f]{128}$/)
	})
	.strict();

const rumorSchema = signedEventSchema.omit({ sig: true });

function decryptConversation(payload: string, privateKey: Uint8Array, publicKey: string): string {
	const conversationKey = getConversationKey(privateKey, publicKey);
	try {
		return nip44Decrypt(payload, conversationKey);
	} finally {
		conversationKey.fill(0);
	}
}
const envelopeSchema = z
	.object({ version: z.literal(RECOVERY_CAPSULE_VERSION), capsule: signedEventSchema })
	.strict();

/**
 * Verify every NIP-59/capsule layer, recover K via recipient NIP-44, and
 * decrypt the share. A signed manifest supplies all expected context.
 */
export function unwrapGiftWrap(
	giftWrap: NostrEvent,
	recipientSecretKey: Uint8Array,
	manifestEvent: NostrEvent
): UnwrappedShare {
	const manifest = parseVerifiedManifest(manifestEvent);
	const recipientPubkey = getPublicKey(recipientSecretKey);

	if (manifest.recipientNostrPubkey !== recipientPubkey) {
		throw new Error('Recovery manifest does not belong to this recipient');
	}
	if (!verifyEvent(giftWrap) || giftWrap.id !== getEventHash(giftWrap)) {
		throw new Error('Invalid gift wrap signature');
	}
	if (giftWrap.id !== manifest.giftWrapEventId) {
		throw new Error('Gift wrap event ID mismatch');
	}
	if (
		giftWrap.kind !== 1059 ||
		JSON.stringify(giftWrap.tags) !== JSON.stringify([['p', recipientPubkey]])
	) {
		throw new Error('Invalid gift wrap recipient binding');
	}
	if (giftWrap.created_at > Math.floor(Date.now() / 1000) + 10 * 60) {
		throw new Error('Gift wrap timestamp is in the future');
	}

	const seal = signedEventSchema.parse(
		JSON.parse(decryptConversation(giftWrap.content, recipientSecretKey, giftWrap.pubkey))
	) as NostrEvent;
	if (!verifyEvent(seal) || seal.id !== getEventHash(seal)) {
		throw new Error('Invalid NIP-59 seal signature');
	}
	if (seal.kind !== 13 || seal.tags.length !== 0) throw new Error('Invalid NIP-59 seal');
	if (seal.pubkey !== manifest.publisherPubkey) throw new Error('Unexpected NIP-59 publisher');

	const rumor = rumorSchema.parse(
		JSON.parse(decryptConversation(seal.content, recipientSecretKey, seal.pubkey))
	);
	if (rumor.id !== getEventHash(rumor)) throw new Error('Invalid NIP-59 rumor ID');
	if (rumor.kind !== KEYFATE_SHARE_KIND || rumor.pubkey !== manifest.publisherPubkey) {
		throw new Error('Invalid NIP-59 rumor binding');
	}

	const envelope = envelopeSchema.parse(JSON.parse(rumor.content));
	if (
		JSON.stringify(rumor.tags) !==
		JSON.stringify([
			['p', recipientPubkey],
			['e', envelope.capsule.id]
		])
	) {
		throw new Error('Invalid NIP-59 rumor tags');
	}
	if (envelope.capsule.id !== manifest.capsuleEventId) {
		throw new Error('Recovery capsule ID mismatch');
	}

	const capsule = parseVerifiedCapsule(
		envelope.capsule as NostrEvent,
		manifest.publisherPubkey,
		recipientPubkey
	);
	if (capsule.secretId !== manifest.secretId || capsule.recipientId !== manifest.recipientId) {
		throw new Error('Recovery capsule context mismatch');
	}

	const encryptedK = decryptConversation(
		capsule.encryptedKNostr,
		recipientSecretKey,
		manifest.publisherPubkey
	);
	if (!/^[0-9a-f]{64}$/.test(encryptedK)) {
		throw new Error('Recovered Nostr key is not 32 bytes');
	}
	const transportKey = hexToBytes(encryptedK);
	let share: string;
	try {
		share = decryptShare(
			hexToBytes(capsule.encryptedShareHex),
			hexToBytes(capsule.nonceHex),
			transportKey
		);
	} finally {
		transportKey.fill(0);
	}
	if (!/^(?:[0-9a-f]{2})+$/.test(share)) throw new Error('Recovered share is malformed');

	return {
		share,
		secretId: capsule.secretId,
		shareIndex: capsule.shareIndex,
		threshold: capsule.threshold,
		totalShares: capsule.totalShares,
		version: capsule.version
	};
}

// ─── Bitcoin Recovery ────────────────────────────────────────────────────────

export interface RecoveredBitcoinShare extends DecryptedShareResult {
	transactionHex: string;
	network: BitcoinNetwork;
	recipientAddress: string;
	generation: number;
}

/** Decrypt and verify a complete recipient-bound Bitcoin recovery envelope. */
export function recoverShareFromBitcoinEnvelope(
	envelope: unknown,
	recipientSecretKey: Uint8Array,
	expectedSenderPubkey: string,
	expectedGeneration: number
): RecoveredBitcoinShare {
	if (!Number.isInteger(expectedGeneration) || expectedGeneration < 1) {
		throw new Error('Expected Bitcoin recovery generation is invalid');
	}
	const content = decryptBitcoinRecoveryEnvelope(
		envelope,
		recipientSecretKey,
		expectedSenderPubkey
	);
	if (content.generation !== expectedGeneration) {
		throw new Error('Bitcoin recovery envelope is not the expected current generation');
	}
	const manifestEvent = parseNostrEvent(content.nostrManifestEvent);
	const capsuleEvent = parseNostrEvent(content.nostrCapsuleEvent);
	const recipientPubkey = getPublicKey(recipientSecretKey);
	const manifestVersion = (JSON.parse(manifestEvent.content) as { version?: unknown }).version;
	const isV3 = manifestVersion === NOSTR_RECOVERY_V3_VERSION;
	const manifest = isV3
		? parseVerifiedManifestV3(manifestEvent)
		: parseVerifiedManifest(manifestEvent);
	if (
		manifest.secretId !== content.secretId ||
		manifest.recipientNostrPubkey !== recipientPubkey ||
		manifest.capsuleEventId !== content.nostrCapsuleEventId ||
		capsuleEvent.id !== content.nostrCapsuleEventId
	) {
		throw new Error('Bitcoin recovery Nostr manifest binding mismatch');
	}

	const capsule = isV3
		? parseVerifiedCapsuleV3(capsuleEvent, manifest as ReturnType<typeof parseVerifiedManifestV3>)
		: parseVerifiedCapsule(capsuleEvent, manifest.publisherPubkey, recipientPubkey);
	if (capsule.secretId !== content.secretId || capsule.recipientId !== manifest.recipientId) {
		throw new Error('Bitcoin recovery capsule context mismatch');
	}

	const transaction = validateBitcoinRecoveryTransaction(content.txHex, {
		fundingTxId: content.fundingTxId,
		fundingOutputIndex: content.fundingOutputIndex,
		fundingAmountSats: content.amountSats,
		timelockScriptHex: content.timelockScriptHex,
		ttlBlocks: content.ttlBlocks,
		recipientAddress: content.recipientAddress,
		network: content.network,
		nostrCapsuleEventId: content.nostrCapsuleEventId,
		maxFeeSats: content.maxFeeSats
	});
	const share = decryptShare(
		hexToBytes(capsule.encryptedShareHex),
		hexToBytes(capsule.nonceHex),
		transaction.symmetricKeyK
	);
	if (isV3) {
		const v3Manifest = manifest as ReturnType<typeof parseVerifiedManifestV3>;
		const envelope = validateRecoveryShareEnvelopeContext(share, {
			index: 2,
			threshold: 2,
			total: v3Manifest.totalShares
		});
		if (
			envelope.setId !== v3Manifest.setId ||
			envelope.protectedSecret.ciphertextDigestHex !== v3Manifest.ciphertextDigestHex
		)
			throw new Error('Bitcoin v3 share envelope binding mismatch');
	} else if (!/^(?:[0-9a-f]{2})+$/.test(share)) {
		throw new Error('Recovered legacy share is malformed');
	}

	return {
		share,
		shareIndex: capsule.shareIndex,
		threshold: capsule.threshold,
		totalShares: capsule.totalShares,
		secretId: capsule.secretId,
		transactionHex: content.txHex,
		network: content.network,
		recipientAddress: content.recipientAddress,
		generation: content.generation
	};
}

/**
 * Parse a hex-encoded Bitcoin transaction to extract OP_RETURN data.
 *
 * Looks for an output with OP_RETURN (0x6a) containing exactly 64 bytes:
 * - First 32 bytes: symmetric key K
 * - Last 32 bytes: Nostr event ID
 *
 * @param txHex - Hex-encoded raw transaction
 * @returns The extracted K and Nostr event ID
 * @throws If no valid OP_RETURN output is found
 */
export function parseOpReturnFromTx(txHex: string): OpReturnData {
	const txBytes = hexToBytes(txHex);

	// Use a minimal transaction parser to find OP_RETURN outputs.
	// Bitcoin tx format: version(4) + inputs + outputs + locktime(4)
	// We use @scure/btc-signer's RawTx decoder.
	let rawTx: { outputs: Array<{ script: Uint8Array; amount: bigint }> };
	try {
		// Dynamic import would be async; instead we parse manually for the OP_RETURN
		// Since we have @scure/btc-signer available, we import it at module level
		rawTx = parseRawTx(txBytes);
	} catch (e) {
		throw new Error(`Failed to parse transaction: ${e instanceof Error ? e.message : String(e)}`);
	}

	// Find the OP_RETURN output
	for (const output of rawTx.outputs) {
		if (output.script.length > 0 && output.script[0] === 0x6a) {
			// OP_RETURN found - extract the data payload
			const data = extractOpReturnData(output.script);
			if (data.length === 64) {
				return {
					symmetricKeyK: data.slice(0, 32),
					nostrEventId: bytesToHex(data.slice(32))
				};
			}
		}
	}

	throw new Error('No valid OP_RETURN output found with 64-byte payload');
}

/**
 * Extract the data payload from an OP_RETURN script.
 *
 * OP_RETURN scripts: 0x6a <push_opcode> <data>
 * For data <= 75 bytes, push opcode is the length byte.
 * For data 76-255 bytes, push opcode is 0x4c followed by length byte.
 */
function extractOpReturnData(script: Uint8Array): Uint8Array {
	if (script[0] !== 0x6a) {
		throw new Error('Not an OP_RETURN script');
	}

	let offset = 1;
	if (offset >= script.length) return new Uint8Array(0);

	const pushByte = script[offset];
	offset++;

	if (pushByte <= 75) {
		// Direct push: pushByte is the length
		return script.slice(offset, offset + pushByte);
	} else if (pushByte === 0x4c) {
		// OP_PUSHDATA1: next byte is length
		if (offset >= script.length) return new Uint8Array(0);
		const len = script[offset];
		offset++;
		return script.slice(offset, offset + len);
	}

	return new Uint8Array(0);
}

/**
 * Minimal Bitcoin raw transaction parser.
 *
 * Parses just enough to extract outputs and their scripts.
 * Handles both legacy and segwit (witness) transactions.
 */
function parseRawTx(bytes: Uint8Array): { outputs: Array<{ script: Uint8Array; amount: bigint }> } {
	let offset = 0;

	function checkBounds(need: number, context: string): void {
		if (offset + need > bytes.length) {
			throw new Error(
				`parseRawTx: buffer overflow reading ${context} at offset ${offset} (need ${need} bytes, have ${bytes.length - offset})`
			);
		}
	}

	function readUint32LE(): number {
		checkBounds(4, 'uint32');
		const val =
			bytes[offset] |
			(bytes[offset + 1] << 8) |
			(bytes[offset + 2] << 16) |
			(bytes[offset + 3] << 24);
		offset += 4;
		return val >>> 0;
	}

	function readUint64LE(): bigint {
		const lo = BigInt(readUint32LE());
		const hi = BigInt(readUint32LE());
		return (hi << 32n) | lo;
	}

	function readVarInt(): number {
		checkBounds(1, 'varint prefix');
		const first = bytes[offset];
		offset++;
		if (first < 0xfd) return first;
		if (first === 0xfd) {
			checkBounds(2, 'varint uint16');
			const val = bytes[offset] | (bytes[offset + 1] << 8);
			offset += 2;
			return val;
		}
		if (first === 0xfe) {
			const val = readUint32LE();
			return val;
		}
		// 0xff - 8 byte, but we don't expect this for tx counts
		throw new Error('VarInt too large');
	}

	function readBytes(n: number): Uint8Array {
		checkBounds(n, `${n}-byte slice`);
		const result = bytes.slice(offset, offset + n);
		offset += n;
		return result;
	}

	// Version
	readUint32LE();

	// Check for segwit marker
	checkBounds(2, 'segwit marker check');
	let isSegwit = false;
	if (bytes[offset] === 0x00 && bytes[offset + 1] === 0x01) {
		isSegwit = true;
		offset += 2;
	}

	// Inputs
	const inputCount = readVarInt();
	for (let i = 0; i < inputCount; i++) {
		readBytes(32); // prev txid
		readUint32LE(); // prev vout
		const scriptLen = readVarInt();
		readBytes(scriptLen); // scriptSig
		readUint32LE(); // sequence
	}

	// Outputs
	const outputCount = readVarInt();
	const outputs: Array<{ script: Uint8Array; amount: bigint }> = [];
	for (let i = 0; i < outputCount; i++) {
		const amount = readUint64LE();
		const scriptLen = readVarInt();
		const script = readBytes(scriptLen);
		outputs.push({ script, amount });
	}

	// We don't need witness data or locktime for our purposes

	return { outputs };
}

// ─── Passphrase Recovery ─────────────────────────────────────────────────────

/**
 * Parse a JSON-encoded encrypted K bundle from a recovery kit.
 *
 * Expected format:
 * {
 *   "ciphertext": "<base64>",
 *   "nonce": "<base64>",
 *   "salt": "<base64>"
 * }
 */
export function parseEncryptedKBundle(bundleJson: string): {
	ciphertext: Uint8Array;
	nonce: Uint8Array;
	salt: Uint8Array;
} {
	let parsed: { ciphertext: string; nonce: string; salt: string };
	try {
		parsed = JSON.parse(bundleJson);
	} catch {
		throw new Error('Invalid JSON: could not parse encrypted K bundle');
	}

	if (!parsed.ciphertext || !parsed.nonce || !parsed.salt) {
		throw new Error('Invalid bundle: must contain ciphertext, nonce, and salt fields');
	}

	return {
		ciphertext: base64ToBytes(parsed.ciphertext),
		nonce: base64ToBytes(parsed.nonce),
		salt: base64ToBytes(parsed.salt)
	};
}

/**
 * Recover K from a passphrase and encrypted K bundle.
 *
 * @param passphrase - The passphrase
 * @param bundle - JSON-encoded encrypted K bundle
 * @returns The 32-byte symmetric key K
 */
export async function recoverKWithPassphrase(
	passphrase: string,
	bundle: { ciphertext: Uint8Array; nonce: Uint8Array; salt: Uint8Array }
): Promise<Uint8Array> {
	const { key: derivedKey } = await deriveKeyFromPassphrase(passphrase, bundle.salt);
	const K = await decryptWithDerivedKey(bundle.ciphertext, bundle.nonce, derivedKey);

	if (K.length !== 32) {
		throw new Error(`Recovered K must be 32 bytes, got ${K.length}`);
	}

	return K;
}

/**
 * Decrypt an encrypted share using the symmetric key K.
 *
 * @param encryptedShareHex - Hex-encoded encrypted share
 * @param nonceHex - Hex-encoded 12-byte nonce
 * @param key - The 32-byte symmetric key K
 * @returns The decrypted share string
 */
export function decryptShareWithK(
	encryptedShareHex: string,
	nonceHex: string,
	key: Uint8Array
): string {
	const encryptedShare = hexToBytes(encryptedShareHex);
	const nonce = hexToBytes(nonceHex);
	return decryptShare(encryptedShare, nonce, key);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert base64 string to Uint8Array */
function base64ToBytes(b64: string): Uint8Array {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}
