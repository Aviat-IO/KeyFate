/**
 * Tests for recovery flow logic functions.
 *
 * Tests the pure-logic functions used by the recovery UI,
 * not the Svelte components themselves.
 *
 * Covers:
 * - nsec validation and decoding
 * - NIP-59 gift wrap unwrapping
 * - Bitcoin OP_RETURN extraction from raw transactions
 * - Passphrase-based K recovery
 * - Encrypted K bundle parsing
 * - Error handling for invalid inputs
 */

import { describe, it, expect } from 'vitest';
import {
	isValidNsec,
	nsecToSecretKey,
	unwrapGiftWrap,
	parseOpReturnFromTx,
	parseEncryptedKBundle,
	recoverKWithPassphrase,
	decryptShareWithK,
	hexToBytes,
	bytesToHex
} from '$lib/crypto/recovery-flows';
import { generateKeypair } from '$lib/nostr/keypair';
import { wrapCapsuleForRecipient, wrapShareForRecipient } from '$lib/nostr/gift-wrap';
import {
	createRecoveryCapsule,
	createRecoveryManifest,
	RECOVERY_CAPSULE_VERSION
} from '$lib/nostr/recovery-capsule';
import { doubleEncryptShare } from '$lib/crypto/double-encrypt';
import { generateSymmetricKey, encryptWithSymmetricKey } from '$lib/crypto/symmetric';
import { deriveKeyFromPassphrase, encryptWithDerivedKey } from '$lib/crypto/passphrase';
import * as nip19 from 'nostr-tools/nip19';

/** Compare Uint8Arrays reliably across jsdom realms. */
function expectBytesEqual(actual: Uint8Array, expected: Uint8Array): void {
	expect(actual.length).toBe(expected.length);
	expect(Array.from(actual)).toEqual(Array.from(expected));
}

// ─── nsec validation ─────────────────────────────────────────────────────────

describe('nsec validation', () => {
	it('validates a correct nsec', () => {
		const kp = generateKeypair();
		expect(isValidNsec(kp.nsec)).toBe(true);
	});

	it('rejects empty string', () => {
		expect(isValidNsec('')).toBe(false);
	});

	it('rejects garbage', () => {
		expect(isValidNsec('not-an-nsec')).toBe(false);
	});

	it('rejects npub (wrong type)', () => {
		const kp = generateKeypair();
		expect(isValidNsec(kp.npub)).toBe(false);
	});

	it('handles whitespace-padded nsec', () => {
		const kp = generateKeypair();
		expect(isValidNsec(`  ${kp.nsec}  `)).toBe(true);
	});
});

describe('nsecToSecretKey', () => {
	it('decodes nsec to 32-byte Uint8Array', () => {
		const kp = generateKeypair();
		const sk = nsecToSecretKey(kp.nsec);
		expect(sk).toBeInstanceOf(Uint8Array);
		expect(sk.length).toBe(32);
		expectBytesEqual(sk, kp.secretKey);
	});

	it('throws on invalid nsec', () => {
		expect(() => nsecToSecretKey('garbage')).toThrow();
	});

	it('throws on npub input', () => {
		const kp = generateKeypair();
		expect(() => nsecToSecretKey(kp.npub)).toThrow('Expected nsec');
	});
});

// ─── Gift wrap unwrapping ────────────────────────────────────────────────────

const SECRET_ID = '11111111-1111-4111-8111-111111111111';
const RECIPIENT_ID = '22222222-2222-4222-8222-222222222222';

async function createV2RecoveryChain(share = '801122334455') {
	const sender = generateKeypair();
	const recipient = generateKeypair();
	const encrypted = await doubleEncryptShare(share, recipient.publicKey, sender.secretKey);
	const capsule = createRecoveryCapsule(
		{
			version: RECOVERY_CAPSULE_VERSION,
			secretId: SECRET_ID,
			recipientId: RECIPIENT_ID,
			recipientNostrPubkey: recipient.publicKey,
			shareIndex: 1,
			threshold: 2,
			totalShares: 3,
			encryptedShareHex: bytesToHex(encrypted.encryptedShare),
			nonceHex: bytesToHex(encrypted.nonce),
			encryptedKNostr: encrypted.encryptedKNostr
		},
		sender.secretKey
	);
	const giftWrap = wrapCapsuleForRecipient(capsule, sender.secretKey, recipient.publicKey);
	const manifest = createRecoveryManifest(
		{
			version: RECOVERY_CAPSULE_VERSION,
			secretId: SECRET_ID,
			recipientId: RECIPIENT_ID,
			recipientNostrPubkey: recipient.publicKey,
			publisherPubkey: sender.publicKey,
			giftWrapEventId: giftWrap.id,
			capsuleEventId: capsule.id
		},
		sender.secretKey
	);
	return { sender, recipient, capsule, giftWrap, manifest, share };
}

describe('unwrapGiftWrap v2 verification', () => {
	it('verifies the complete chain, recovers K, and decrypts the share', async () => {
		const chain = await createV2RecoveryChain();
		const result = unwrapGiftWrap(chain.giftWrap, chain.recipient.secretKey, chain.manifest);

		expect(result).toEqual({
			share: chain.share,
			secretId: SECRET_ID,
			shareIndex: 1,
			threshold: 2,
			totalShares: 3,
			version: 2
		});
	});

	it('rejects a wrong recipient before accepting the capsule', async () => {
		const chain = await createV2RecoveryChain();
		const wrongRecipient = generateKeypair();
		expect(() => unwrapGiftWrap(chain.giftWrap, wrongRecipient.secretKey, chain.manifest)).toThrow(
			'does not belong to this recipient'
		);
	});

	it('rejects a modified outer event signature', async () => {
		const chain = await createV2RecoveryChain();
		const modified = { ...chain.giftWrap, content: `${chain.giftWrap.content}x` };
		expect(() => unwrapGiftWrap(modified, chain.recipient.secretKey, chain.manifest)).toThrow(
			'Invalid gift wrap signature'
		);
	});

	it('rejects a valid legacy v1 event rather than interpreting it as v2', async () => {
		const chain = await createV2RecoveryChain();
		const legacy = wrapShareForRecipient(
			{
				share: 'aabb',
				secretId: SECRET_ID,
				shareIndex: 1,
				threshold: 2,
				totalShares: 3,
				version: 1
			},
			chain.sender.secretKey,
			chain.recipient.publicKey
		);
		const legacyManifest = createRecoveryManifest(
			{
				version: RECOVERY_CAPSULE_VERSION,
				secretId: SECRET_ID,
				recipientId: RECIPIENT_ID,
				recipientNostrPubkey: chain.recipient.publicKey,
				publisherPubkey: chain.sender.publicKey,
				giftWrapEventId: legacy.id,
				capsuleEventId: chain.capsule.id
			},
			chain.sender.secretKey
		);
		expect(() => unwrapGiftWrap(legacy, chain.recipient.secretKey, legacyManifest)).toThrow();
	});
});

// ─── Bitcoin OP_RETURN extraction ────────────────────────────────────────────

describe('parseOpReturnFromTx', () => {
	/**
	 * Build a minimal valid Bitcoin transaction hex with an OP_RETURN output.
	 *
	 * Format: version(4) + input_count(1) + inputs + output_count(1) + outputs + locktime(4)
	 */
	function buildTxWithOpReturn(opReturnData: Uint8Array): string {
		const parts: number[] = [];

		// Version (4 bytes LE) - version 2
		parts.push(0x02, 0x00, 0x00, 0x00);

		// Input count: 1
		parts.push(0x01);

		// Input: prev txid (32 bytes) + prev vout (4 bytes) + scriptSig len (1) + sequence (4)
		for (let i = 0; i < 32; i++) parts.push(0xaa);
		parts.push(0x00, 0x00, 0x00, 0x00); // vout
		parts.push(0x00); // scriptSig length = 0
		parts.push(0xff, 0xff, 0xff, 0xff); // sequence

		// Output count: 2
		parts.push(0x02);

		// Output 1: OP_RETURN (amount = 0)
		parts.push(0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00); // 0 sats
		// OP_RETURN script: 0x6a + push_byte(len) + data
		const opReturnScript = [0x6a, opReturnData.length, ...opReturnData];
		parts.push(opReturnScript.length); // scriptPubKey length
		parts.push(...opReturnScript);

		// Output 2: P2WPKH (some amount)
		parts.push(0x10, 0x27, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00); // 10000 sats
		// P2WPKH script: OP_0 <20-byte hash>
		const p2wpkhScript = [0x00, 0x14, ...new Array(20).fill(0xbb)];
		parts.push(p2wpkhScript.length);
		parts.push(...p2wpkhScript);

		// Locktime (4 bytes)
		parts.push(0x00, 0x00, 0x00, 0x00);

		return bytesToHex(new Uint8Array(parts));
	}

	it('extracts K and event ID from a valid OP_RETURN', () => {
		const K = new Uint8Array(32).fill(0xaa);
		const eventIdBytes = new Uint8Array(32).fill(0xbb);
		const payload = new Uint8Array(64);
		payload.set(K, 0);
		payload.set(eventIdBytes, 32);

		const txHex = buildTxWithOpReturn(payload);
		const result = parseOpReturnFromTx(txHex);

		expectBytesEqual(result.symmetricKeyK, K);
		expect(result.nostrEventId).toBe('bb'.repeat(32));
	});

	it('handles real-looking K and event ID values', () => {
		const K = new Uint8Array(32);
		const eventId = new Uint8Array(32);
		for (let i = 0; i < 32; i++) {
			K[i] = i;
			eventId[i] = 255 - i;
		}

		const payload = new Uint8Array(64);
		payload.set(K, 0);
		payload.set(eventId, 32);

		const txHex = buildTxWithOpReturn(payload);
		const result = parseOpReturnFromTx(txHex);

		expectBytesEqual(result.symmetricKeyK, K);
		expect(result.nostrEventId).toBe(bytesToHex(eventId));
	});

	it('throws for invalid transaction hex', () => {
		expect(() => parseOpReturnFromTx('not-valid-hex')).toThrow();
	});

	it('throws for transaction without OP_RETURN', () => {
		// Build a tx with no OP_RETURN
		const parts: number[] = [];
		parts.push(0x02, 0x00, 0x00, 0x00); // version
		parts.push(0x01); // 1 input
		for (let i = 0; i < 32; i++) parts.push(0xaa); // prev txid
		parts.push(0x00, 0x00, 0x00, 0x00); // vout
		parts.push(0x00); // scriptSig len
		parts.push(0xff, 0xff, 0xff, 0xff); // sequence
		parts.push(0x01); // 1 output
		parts.push(0x10, 0x27, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00); // amount
		const script = [0x00, 0x14, ...new Array(20).fill(0xbb)];
		parts.push(script.length);
		parts.push(...script);
		parts.push(0x00, 0x00, 0x00, 0x00); // locktime

		const txHex = bytesToHex(new Uint8Array(parts));
		expect(() => parseOpReturnFromTx(txHex)).toThrow('No valid OP_RETURN');
	});

	it('throws for OP_RETURN with wrong payload size', () => {
		// 32 bytes instead of 64
		const shortPayload = new Uint8Array(32).fill(0xcc);
		const txHex = buildTxWithOpReturn(shortPayload);
		expect(() => parseOpReturnFromTx(txHex)).toThrow('No valid OP_RETURN');
	});

	it('handles segwit transactions', () => {
		// Build a segwit tx (with marker+flag bytes)
		const K = new Uint8Array(32).fill(0xdd);
		const eventId = new Uint8Array(32).fill(0xee);
		const payload = new Uint8Array(64);
		payload.set(K, 0);
		payload.set(eventId, 32);

		const parts: number[] = [];
		parts.push(0x02, 0x00, 0x00, 0x00); // version
		parts.push(0x00, 0x01); // segwit marker + flag
		parts.push(0x01); // 1 input
		for (let i = 0; i < 32; i++) parts.push(0xaa); // prev txid
		parts.push(0x00, 0x00, 0x00, 0x00); // vout
		parts.push(0x00); // scriptSig len
		parts.push(0x90, 0x00, 0x00, 0x00); // sequence = 144 (CSV)

		// 2 outputs
		parts.push(0x02);

		// OP_RETURN output
		parts.push(0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00); // 0 sats
		const opReturnScript = [0x6a, payload.length, ...payload];
		parts.push(opReturnScript.length);
		parts.push(...opReturnScript);

		// P2WPKH output
		parts.push(0x10, 0x27, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);
		const p2wpkhScript = [0x00, 0x14, ...new Array(20).fill(0xbb)];
		parts.push(p2wpkhScript.length);
		parts.push(...p2wpkhScript);

		// Witness data (1 input, 2 items)
		parts.push(0x02); // 2 witness items
		parts.push(0x47); // 71 bytes signature
		for (let i = 0; i < 71; i++) parts.push(0x30);
		parts.push(0x00); // empty item (FALSE for ELSE branch)

		// Locktime
		parts.push(0x00, 0x00, 0x00, 0x00);

		const txHex = bytesToHex(new Uint8Array(parts));
		const result = parseOpReturnFromTx(txHex);

		expectBytesEqual(result.symmetricKeyK, K);
		expect(result.nostrEventId).toBe('ee'.repeat(32));
	});
});

// ─── Encrypted K bundle parsing ──────────────────────────────────────────────

describe('parseEncryptedKBundle', () => {
	it('parses a valid JSON bundle', () => {
		const ciphertext = new Uint8Array([1, 2, 3, 4]);
		const nonce = new Uint8Array([5, 6, 7, 8]);
		const salt = new Uint8Array([9, 10, 11, 12]);

		const json = JSON.stringify({
			ciphertext: btoa(String.fromCharCode(...ciphertext)),
			nonce: btoa(String.fromCharCode(...nonce)),
			salt: btoa(String.fromCharCode(...salt))
		});

		const result = parseEncryptedKBundle(json);

		expectBytesEqual(result.ciphertext, ciphertext);
		expectBytesEqual(result.nonce, nonce);
		expectBytesEqual(result.salt, salt);
	});

	it('throws on invalid JSON', () => {
		expect(() => parseEncryptedKBundle('not json')).toThrow('Invalid JSON');
	});

	it('throws on missing fields', () => {
		expect(() => parseEncryptedKBundle('{"ciphertext":"abc"}')).toThrow('Invalid bundle');
		expect(() => parseEncryptedKBundle('{}')).toThrow('Invalid bundle');
	});
});

// ─── Passphrase-based K recovery ─────────────────────────────────────────────

describe('recoverKWithPassphrase', () => {
	it('recovers K from passphrase and bundle', async () => {
		const K = generateSymmetricKey();
		const passphrase = 'correct-horse-battery-staple';

		// Encrypt K with passphrase
		const { key: derivedKey, salt } = await deriveKeyFromPassphrase(passphrase);
		const { ciphertext, nonce } = await encryptWithDerivedKey(K, derivedKey);

		const recovered = await recoverKWithPassphrase(passphrase, {
			ciphertext,
			nonce,
			salt
		});

		expectBytesEqual(recovered, K);
	});

	it('fails with wrong passphrase', async () => {
		const K = generateSymmetricKey();
		const { key: derivedKey, salt } = await deriveKeyFromPassphrase('right-pass');
		const { ciphertext, nonce } = await encryptWithDerivedKey(K, derivedKey);

		await expect(
			recoverKWithPassphrase('wrong-pass', { ciphertext, nonce, salt })
		).rejects.toThrow();
	});
});

// ─── Share decryption with K ─────────────────────────────────────────────────

describe('decryptShareWithK', () => {
	it('decrypts a share using hex-encoded inputs', () => {
		const K = generateSymmetricKey();
		const share = 'my-secret-shamir-share';
		const shareBytes = new TextEncoder().encode(share);
		const { ciphertext, nonce } = encryptWithSymmetricKey(shareBytes, K);

		const result = decryptShareWithK(bytesToHex(ciphertext), bytesToHex(nonce), K);

		expect(result).toBe(share);
	});

	it('throws with wrong key', () => {
		const K1 = generateSymmetricKey();
		const K2 = generateSymmetricKey();
		const shareBytes = new TextEncoder().encode('share');
		const { ciphertext, nonce } = encryptWithSymmetricKey(shareBytes, K1);

		expect(() => decryptShareWithK(bytesToHex(ciphertext), bytesToHex(nonce), K2)).toThrow();
	});

	it('handles unicode shares', () => {
		const K = generateSymmetricKey();
		const share = 'Share with emoji: \u{1F512}\u{1F511}';
		const shareBytes = new TextEncoder().encode(share);
		const { ciphertext, nonce } = encryptWithSymmetricKey(shareBytes, K);

		const result = decryptShareWithK(bytesToHex(ciphertext), bytesToHex(nonce), K);

		expect(result).toBe(share);
	});
});

// ─── Hex utilities ───────────────────────────────────────────────────────────

describe('hex utilities', () => {
	describe('hexToBytes', () => {
		it('converts hex to bytes', () => {
			const bytes = hexToBytes('aabbccdd');
			expect(Array.from(bytes)).toEqual([0xaa, 0xbb, 0xcc, 0xdd]);
		});

		it('handles 0x prefix', () => {
			const bytes = hexToBytes('0xaabbccdd');
			expect(Array.from(bytes)).toEqual([0xaa, 0xbb, 0xcc, 0xdd]);
		});

		it('handles whitespace', () => {
			const bytes = hexToBytes('aa bb cc dd');
			expect(Array.from(bytes)).toEqual([0xaa, 0xbb, 0xcc, 0xdd]);
		});

		it('throws on odd-length hex', () => {
			expect(() => hexToBytes('abc')).toThrow('even length');
		});

		it('handles empty string', () => {
			const bytes = hexToBytes('');
			expect(bytes.length).toBe(0);
		});
	});

	describe('bytesToHex', () => {
		it('converts bytes to hex', () => {
			const hex = bytesToHex(new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]));
			expect(hex).toBe('aabbccdd');
		});

		it('pads single-digit values', () => {
			const hex = bytesToHex(new Uint8Array([0x01, 0x0a]));
			expect(hex).toBe('010a');
		});

		it('handles empty array', () => {
			expect(bytesToHex(new Uint8Array(0))).toBe('');
		});
	});

	describe('round-trip', () => {
		it('hex → bytes → hex', () => {
			const original = 'deadbeef01020304';
			expect(bytesToHex(hexToBytes(original))).toBe(original);
		});

		it('bytes → hex → bytes', () => {
			const original = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
			expectBytesEqual(hexToBytes(bytesToHex(original)), original);
		});
	});
});

// ─── End-to-end integration ──────────────────────────────────────────────────

describe('end-to-end recovery flow', () => {
	it('Nostr: owner publish artifact → recipient verified plaintext share', async () => {
		const chain = await createV2RecoveryChain('80deadbeef');
		const recovered = unwrapGiftWrap(chain.giftWrap, chain.recipient.secretKey, chain.manifest);
		expect(recovered.share).toBe('80deadbeef');
		expect(recovered.secretId).toBe(SECRET_ID);
	});

	it('Passphrase: encrypt K → bundle → recover K → decrypt share', async () => {
		// Encrypt a share
		const K = generateSymmetricKey();
		const shareText = 'another-shamir-share';
		const shareBytes = new TextEncoder().encode(shareText);
		const { ciphertext: encShare, nonce: shareNonce } = encryptWithSymmetricKey(shareBytes, K);

		// Encrypt K with passphrase
		const passphrase = 'my-recovery-passphrase';
		const { key: derivedKey, salt } = await deriveKeyFromPassphrase(passphrase);
		const { ciphertext: encK, nonce: kNonce } = await encryptWithDerivedKey(K, derivedKey);

		// Simulate the bundle JSON (as it would appear in recovery kit)
		const bundleJson = JSON.stringify({
			ciphertext: btoa(String.fromCharCode(...encK)),
			nonce: btoa(String.fromCharCode(...kNonce)),
			salt: btoa(String.fromCharCode(...salt))
		});

		// Parse and recover
		const bundle = parseEncryptedKBundle(bundleJson);
		const recoveredK = await recoverKWithPassphrase(passphrase, bundle);

		expectBytesEqual(recoveredK, K);

		// Decrypt share
		const decrypted = decryptShareWithK(bytesToHex(encShare), bytesToHex(shareNonce), recoveredK);
		expect(decrypted).toBe(shareText);
	});

	it('Bitcoin: build tx → parse OP_RETURN → extract K', () => {
		const K = generateSymmetricKey();
		const eventId = 'ab'.repeat(32);

		// Build a minimal tx with OP_RETURN containing K + event ID
		const payload = new Uint8Array(64);
		payload.set(K, 0);
		payload.set(hexToBytes(eventId), 32);

		// Build tx manually
		const parts: number[] = [];
		parts.push(0x02, 0x00, 0x00, 0x00); // version
		parts.push(0x01); // 1 input
		for (let i = 0; i < 32; i++) parts.push(0xaa);
		parts.push(0x00, 0x00, 0x00, 0x00);
		parts.push(0x00);
		parts.push(0xff, 0xff, 0xff, 0xff);
		parts.push(0x02); // 2 outputs
		// OP_RETURN
		parts.push(0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);
		const opScript = [0x6a, payload.length, ...payload];
		parts.push(opScript.length);
		parts.push(...opScript);
		// P2WPKH
		parts.push(0x10, 0x27, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);
		const p2wpkh = [0x00, 0x14, ...new Array(20).fill(0xbb)];
		parts.push(p2wpkh.length);
		parts.push(...p2wpkh);
		parts.push(0x00, 0x00, 0x00, 0x00); // locktime

		const txHex = bytesToHex(new Uint8Array(parts));
		const result = parseOpReturnFromTx(txHex);

		expectBytesEqual(result.symmetricKeyK, K);
		expect(result.nostrEventId).toBe(eventId);

		// Use K to decrypt a share
		const shareText = 'bitcoin-recovered-share';
		const shareBytes = new TextEncoder().encode(shareText);
		const { ciphertext, nonce } = encryptWithSymmetricKey(shareBytes, result.symmetricKeyK);

		const decrypted = decryptShareWithK(
			bytesToHex(ciphertext),
			bytesToHex(nonce),
			result.symmetricKeyK
		);
		expect(decrypted).toBe(shareText);
	});
});
