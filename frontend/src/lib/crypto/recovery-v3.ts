import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { Buffer } from 'buffer';
import sss from 'shamirs-secret-sharing';
import { z } from 'zod';
import { bytesToHex } from './hex-utils';

export const RECOVERY_V3_SCHEME = 'keyfate-shamir-chacha20poly1305' as const;
export const RECOVERY_V3_VERSION = 3 as const;

const PROTECTED_SECRET_FORMAT = 'keyfate-protected-secret' as const;
const PROTECTED_SECRET_VERSION = 3 as const;
const PROTECTED_SECRET_DOMAIN = 'keyfate/recovery-v3/protected-secret' as const;
const CIPHER = 'chacha20-poly1305' as const;
const CONTENT_KEY_LENGTH = 32;
const NONCE_LENGTH = 12;
const SET_ID_LENGTH = 16;
const SHAMIR_SHARE_LENGTH = 82;
const SHAMIR_SHARE_HEADER_LENGTH = 2;
const SHAMIR_FIELD_BITS = 8;
const AEAD_TAG_LENGTH = 16;
const PROTECTED_SECRET_JSON_OVERHEAD_BYTES = 61;
const HEX_PATTERN = /^[0-9a-f]+$/;

export const MAX_RECOVERY_V3_SECRET_BYTES = 64 * 1024;
export const MAX_RECOVERY_V3_CIPHERTEXT_BYTES =
	MAX_RECOVERY_V3_SECRET_BYTES * 6 + PROTECTED_SECRET_JSON_OVERHEAD_BYTES + AEAD_TAG_LENGTH;
export const MAX_RECOVERY_V3_ENVELOPE_BYTES = MAX_RECOVERY_V3_CIPHERTEXT_BYTES * 2 + 1024;
export const MAX_RECOVERY_V3_TOTAL_SHARES = 7;
export const MAX_NOSTR_ENCRYPTED_SHARE_HEX_LENGTH = 131_072;
/**
 * Conservative pre-network cap for the serialized share envelope. NIP-44 padding expands in
 * discrete buckets at both the seal and outer gift-wrap layers; 52,000 bytes remains below the
 * 262,144-byte signed-event content cap while the next observed padding bucket does not.
 */
export const MAX_NOSTR_V3_RECOVERY_ENVELOPE_BYTES = 52_000;

const protectedSecretSchema = z
	.object({
		cipher: z.literal(CIPHER),
		nonceHex: z
			.string()
			.length(NONCE_LENGTH * 2)
			.regex(HEX_PATTERN),
		ciphertextHex: z
			.string()
			.min(AEAD_TAG_LENGTH * 2)
			.max(MAX_RECOVERY_V3_CIPHERTEXT_BYTES * 2)
			.regex(HEX_PATTERN)
			.refine((value) => value.length % 2 === 0),
		ciphertextDigestHex: z.string().length(64).regex(HEX_PATTERN)
	})
	.strict();

export const recoveryShareEnvelopeSchema = z
	.object({
		scheme: z.literal(RECOVERY_V3_SCHEME),
		version: z.literal(RECOVERY_V3_VERSION),
		setId: z
			.string()
			.length(SET_ID_LENGTH * 2)
			.regex(HEX_PATTERN),
		threshold: z.number().int().min(2).max(MAX_RECOVERY_V3_TOTAL_SHARES),
		total: z.number().int().min(2).max(MAX_RECOVERY_V3_TOTAL_SHARES),
		index: z.number().int().min(1).max(MAX_RECOVERY_V3_TOTAL_SHARES),
		shareHex: z
			.string()
			.length(SHAMIR_SHARE_LENGTH * 2)
			.regex(HEX_PATTERN),
		protectedSecret: protectedSecretSchema
	})
	.strict()
	.superRefine((value, context) => {
		if (value.threshold > value.total) {
			context.addIssue({ code: 'custom', message: 'threshold cannot exceed total' });
		}
		if (value.index > value.total) {
			context.addIssue({ code: 'custom', message: 'index cannot exceed total' });
		}
	});

const secretPayloadSchema = z
	.object({
		format: z.literal(PROTECTED_SECRET_FORMAT),
		version: z.literal(PROTECTED_SECRET_VERSION),
		secret: z
			.string()
			.refine(
				(value) =>
					utf8ByteLengthAtMost(value, MAX_RECOVERY_V3_SECRET_BYTES) <= MAX_RECOVERY_V3_SECRET_BYTES,
				`Secret exceeds maximum UTF-8 length of ${MAX_RECOVERY_V3_SECRET_BYTES} bytes`
			)
	})
	.strict();

export type RecoveryShareEnvelope = z.infer<typeof recoveryShareEnvelopeSchema>;

export interface RecoveryV3Context {
	setId: string;
	threshold: number;
	total: number;
}

export interface AuthenticatedRecoverySet {
	setId: string;
	envelopes: string[];
}

function utf8ByteLengthAtMost(value: string, maximum: number): number {
	let length = 0;
	for (let index = 0; index < value.length; index += 1) {
		const codeUnit = value.charCodeAt(index);
		if (codeUnit <= 0x7f) {
			length += 1;
		} else if (codeUnit <= 0x7ff) {
			length += 2;
		} else if (
			codeUnit >= 0xd800 &&
			codeUnit <= 0xdbff &&
			index + 1 < value.length &&
			value.charCodeAt(index + 1) >= 0xdc00 &&
			value.charCodeAt(index + 1) <= 0xdfff
		) {
			length += 4;
			index += 1;
		} else {
			length += 3;
		}
		if (length > maximum) return length;
	}
	return length;
}

function secureRandomBytes(length: number): Uint8Array {
	const cryptoApi = globalThis.crypto;
	if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
		throw new Error('Secure random number generator unavailable');
	}

	const output = new Uint8Array(length);
	try {
		return cryptoApi.getRandomValues(output);
	} catch (error) {
		output.fill(0);
		throw new Error('Secure random number generator failed', { cause: error });
	}
}

function strictHexToBytes(value: string): Uint8Array {
	if (value.length % 2 !== 0 || !HEX_PATTERN.test(value)) {
		throw new Error('Invalid lowercase hex');
	}
	return Uint8Array.from(Buffer.from(value, 'hex'));
}

function canonicalEnvelope(envelope: RecoveryShareEnvelope): RecoveryShareEnvelope {
	return {
		scheme: envelope.scheme,
		version: envelope.version,
		setId: envelope.setId,
		threshold: envelope.threshold,
		total: envelope.total,
		index: envelope.index,
		shareHex: envelope.shareHex,
		protectedSecret: {
			cipher: envelope.protectedSecret.cipher,
			nonceHex: envelope.protectedSecret.nonceHex,
			ciphertextHex: envelope.protectedSecret.ciphertextHex,
			ciphertextDigestHex: envelope.protectedSecret.ciphertextDigestHex
		}
	};
}

/** Build the canonical, domain-separated AAD for one protected secret. */
export function buildProtectedSecretAad(context: RecoveryV3Context): Uint8Array {
	const parsed = z
		.object({
			setId: z
				.string()
				.length(SET_ID_LENGTH * 2)
				.regex(HEX_PATTERN),
			threshold: z.number().int().min(2).max(MAX_RECOVERY_V3_TOTAL_SHARES),
			total: z.number().int().min(2).max(MAX_RECOVERY_V3_TOTAL_SHARES)
		})
		.strict()
		.refine((value) => value.threshold <= value.total)
		.parse(context);

	return new TextEncoder().encode(
		JSON.stringify({
			domain: PROTECTED_SECRET_DOMAIN,
			scheme: RECOVERY_V3_SCHEME,
			version: RECOVERY_V3_VERSION,
			setId: parsed.setId,
			threshold: parsed.threshold,
			total: parsed.total,
			payloadFormat: PROTECTED_SECRET_FORMAT,
			payloadVersion: PROTECTED_SECRET_VERSION,
			cipher: CIPHER
		})
	);
}

/**
 * Fail before persistence when Nostr's encrypted-share capsule cannot contain an envelope.
 * ChaCha20-Poly1305 appends a 16-byte tag before the ciphertext is hex encoded.
 */
export function assertRecoveryEnvelopeFitsNostrCapsule(serialized: string): void {
	if (
		typeof serialized !== 'string' ||
		utf8ByteLengthAtMost(serialized, MAX_NOSTR_V3_RECOVERY_ENVELOPE_BYTES) >
			MAX_NOSTR_V3_RECOVERY_ENVELOPE_BYTES
	) {
		throw new Error(
			'Authenticated recovery envelope exceeds the safe nested Nostr gift-wrap limit'
		);
	}
}

/** Parse an exact v3 JSON share envelope. This function never parses legacy shares. */
export function parseRecoveryShareEnvelope(serialized: string): RecoveryShareEnvelope {
	if (
		typeof serialized !== 'string' ||
		utf8ByteLengthAtMost(serialized, MAX_RECOVERY_V3_ENVELOPE_BYTES) >
			MAX_RECOVERY_V3_ENVELOPE_BYTES
	) {
		throw new Error('v3 share envelope exceeds maximum size');
	}

	try {
		const value: unknown = JSON.parse(serialized);
		const result = recoveryShareEnvelopeSchema.safeParse(value);
		if (!result.success) throw result.error;
		return result.data;
	} catch (error) {
		throw new Error('Invalid v3 share envelope', { cause: error });
	}
}

/** Validate the public ciphertext digest before accepting an envelope at a trust boundary. */
export function validateRecoveryShareEnvelopeIntegrity(serialized: string): RecoveryShareEnvelope {
	const envelope = parseRecoveryShareEnvelope(serialized);
	const ciphertext = strictHexToBytes(envelope.protectedSecret.ciphertextHex);
	try {
		if (bytesToHex(sha256(ciphertext)) !== envelope.protectedSecret.ciphertextDigestHex) {
			throw new Error('Protected-secret ciphertext digest does not match');
		}
		return envelope;
	} finally {
		ciphertext.fill(0);
	}
}

/** Serialize a validated v3 envelope using a stable property order. */
export function serializeRecoveryShareEnvelope(envelope: RecoveryShareEnvelope): string {
	const result = recoveryShareEnvelopeSchema.safeParse(envelope);
	if (!result.success) {
		throw new Error('Invalid v3 share envelope', { cause: result.error });
	}
	return JSON.stringify(canonicalEnvelope(result.data));
}

function embeddedShamirIndex(shareHex: string): number {
	const share = strictHexToBytes(shareHex);
	if (share.length !== SHAMIR_SHARE_LENGTH || share[0] !== SHAMIR_FIELD_BITS) {
		throw new Error('Invalid embedded Shamir share format');
	}
	return share[1];
}

export function validateRecoveryShareEnvelopeContext(
	serialized: string,
	expected: { index: number; threshold: number; total: number }
): RecoveryShareEnvelope {
	const envelope = validateRecoveryShareEnvelopeIntegrity(serialized);
	const actualIndex = embeddedShamirIndex(envelope.shareHex);
	if (envelope.index !== actualIndex) {
		throw new Error('Share wrapper index does not match embedded Shamir identifier');
	}
	if (actualIndex !== expected.index) {
		throw new Error(`Envelope does not have expected recovery share index ${expected.index}`);
	}
	if (envelope.threshold !== expected.threshold || envelope.total !== expected.total) {
		throw new Error('Recovery share does not match the expected threshold and total');
	}
	return envelope;
}

function protectedMetadataMatches(
	candidate: RecoveryShareEnvelope,
	expected: RecoveryShareEnvelope
): boolean {
	return (
		candidate.scheme === expected.scheme &&
		candidate.version === expected.version &&
		candidate.setId === expected.setId &&
		candidate.threshold === expected.threshold &&
		candidate.total === expected.total &&
		candidate.protectedSecret.cipher === expected.protectedSecret.cipher &&
		candidate.protectedSecret.nonceHex === expected.protectedSecret.nonceHex &&
		candidate.protectedSecret.ciphertextHex === expected.protectedSecret.ciphertextHex &&
		candidate.protectedSecret.ciphertextDigestHex === expected.protectedSecret.ciphertextDigestHex
	);
}

/**
 * Protect a structured secret and create authenticated v3 share envelopes.
 * Only the uniformly random 32-byte content key is Shamir-split.
 */
export function createAuthenticatedRecoverySet(
	secret: string,
	options: { threshold: number; total: number }
): AuthenticatedRecoverySet {
	const context = z
		.object({
			threshold: z.number().int().min(2).max(MAX_RECOVERY_V3_TOTAL_SHARES),
			total: z.number().int().min(2).max(MAX_RECOVERY_V3_TOTAL_SHARES)
		})
		.strict()
		.refine((value) => value.threshold <= value.total, 'threshold cannot exceed total')
		.parse(options);
	if (
		typeof secret !== 'string' ||
		utf8ByteLengthAtMost(secret, MAX_RECOVERY_V3_SECRET_BYTES) > MAX_RECOVERY_V3_SECRET_BYTES
	) {
		throw new Error(`Secret exceeds maximum UTF-8 length of ${MAX_RECOVERY_V3_SECRET_BYTES} bytes`);
	}

	const setId = bytesToHex(secureRandomBytes(SET_ID_LENGTH));
	const contentKey = secureRandomBytes(CONTENT_KEY_LENGTH);
	let nonce: Uint8Array | undefined;
	let aad: Uint8Array | undefined;
	let plaintext: Uint8Array | undefined;
	let shamirInput: Buffer | undefined;
	let shamirEntropy: Uint8Array | undefined;
	let ciphertext: Uint8Array | undefined;
	let shares: Buffer[] = [];

	try {
		nonce = secureRandomBytes(NONCE_LENGTH);
		aad = buildProtectedSecretAad({ setId, ...context });
		plaintext = new TextEncoder().encode(
			JSON.stringify({
				format: PROTECTED_SECRET_FORMAT,
				version: PROTECTED_SECRET_VERSION,
				secret
			})
		);
		if (plaintext.length + AEAD_TAG_LENGTH > MAX_RECOVERY_V3_CIPHERTEXT_BYTES) {
			throw new Error('Protected secret exceeds maximum ciphertext length');
		}
		shamirInput = Buffer.from(contentKey);

		const polynomialPartCount = SHAMIR_SHARE_LENGTH - SHAMIR_SHARE_HEADER_LENGTH;
		const polynomialEntropy = secureRandomBytes(polynomialPartCount * (context.threshold - 1));
		shamirEntropy = polynomialEntropy;
		let entropyOffset = 0;
		let entropyMismatch = false;
		const deterministicRandom = (length: number): Buffer => {
			const available = entropyOffset < polynomialEntropy.length;
			const output = Buffer.from([available ? polynomialEntropy[entropyOffset] : 0]);
			if (length !== 1 || !available) entropyMismatch = true;
			entropyOffset += 1;
			return output;
		};

		ciphertext = chacha20poly1305(contentKey, nonce, aad).encrypt(plaintext);
		const protectedSecret: RecoveryShareEnvelope['protectedSecret'] = {
			cipher: CIPHER,
			nonceHex: bytesToHex(nonce),
			ciphertextHex: bytesToHex(ciphertext),
			ciphertextDigestHex: bytesToHex(sha256(ciphertext))
		};
		const splitOptions = {
			shares: context.total,
			threshold: context.threshold,
			random: deterministicRandom
		};
		shares = sss.split(shamirInput, splitOptions);
		if (entropyMismatch || entropyOffset !== polynomialEntropy.length) {
			throw new Error('Incompatible Shamir codec polynomial entropy consumption');
		}

		const envelopes = shares.map((share) => {
			const shareHex = share.toString('hex');
			const index = embeddedShamirIndex(shareHex);
			return serializeRecoveryShareEnvelope({
				scheme: RECOVERY_V3_SCHEME,
				version: RECOVERY_V3_VERSION,
				setId,
				threshold: context.threshold,
				total: context.total,
				index,
				shareHex,
				protectedSecret
			});
		});

		return { setId, envelopes };
	} finally {
		contentKey.fill(0);
		nonce?.fill(0);
		aad?.fill(0);
		plaintext?.fill(0);
		shamirInput?.fill(0);
		shamirEntropy?.fill(0);
		ciphertext?.fill(0);
		for (const share of shares) share.fill(0);
	}
}

/**
 * Validate and reconstruct a v3 set, returning plaintext only after AEAD authentication.
 * Invalid v3 input is never passed to a legacy reconstruction path.
 */
export function recoverAuthenticatedSecret(serializedEnvelopes: readonly string[]): string {
	if (serializedEnvelopes.length === 0) {
		throw new Error('At least one v3 share envelope is required');
	}
	if (serializedEnvelopes.length > MAX_RECOVERY_V3_TOTAL_SHARES) {
		throw new Error('v3 recovery share count exceeds protocol maximum');
	}

	const expected = validateRecoveryShareEnvelopeIntegrity(serializedEnvelopes[0]);
	if (serializedEnvelopes.length > expected.total) {
		throw new Error('v3 recovery share count exceeds declared total');
	}
	const envelopes = [expected];
	for (let index = 1; index < serializedEnvelopes.length; index += 1) {
		envelopes.push(parseRecoveryShareEnvelope(serializedEnvelopes[index]));
	}
	const indices = new Set<number>();

	for (const envelope of envelopes) {
		const embeddedIndex = embeddedShamirIndex(envelope.shareHex);
		if (embeddedIndex !== envelope.index) {
			throw new Error('Share wrapper index does not match embedded Shamir identifier');
		}
		if (!protectedMetadataMatches(envelope, expected)) {
			throw new Error('Recovery share metadata does not match');
		}
		if (indices.has(envelope.index)) {
			throw new Error(`Duplicate share index ${envelope.index}`);
		}
		indices.add(envelope.index);
	}

	if (indices.size < expected.threshold) {
		throw new Error(`Recovery requires at least ${expected.threshold} distinct shares`);
	}

	const ciphertext = strictHexToBytes(expected.protectedSecret.ciphertextHex);
	const actualDigest = bytesToHex(sha256(ciphertext));
	if (actualDigest !== expected.protectedSecret.ciphertextDigestHex) {
		throw new Error('Protected-secret ciphertext digest does not match');
	}

	const shareBuffers = envelopes.map((envelope) => Buffer.from(envelope.shareHex, 'hex'));
	let combined: Buffer;
	try {
		combined = sss.combine(shareBuffers);
	} finally {
		for (const share of shareBuffers) share.fill(0);
	}
	const contentKey = Uint8Array.from(combined);
	combined.fill(0);

	if (contentKey.length !== CONTENT_KEY_LENGTH) {
		contentKey.fill(0);
		throw new Error(`Reconstructed content key must be ${CONTENT_KEY_LENGTH} bytes`);
	}

	const nonce = strictHexToBytes(expected.protectedSecret.nonceHex);
	const aad = buildProtectedSecretAad({
		setId: expected.setId,
		threshold: expected.threshold,
		total: expected.total
	});
	let plaintext: Uint8Array | undefined;
	try {
		plaintext = chacha20poly1305(contentKey, nonce, aad).decrypt(ciphertext);
		const decoded: unknown = JSON.parse(
			new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
		);
		const payload = secretPayloadSchema.safeParse(decoded);
		if (!payload.success) {
			throw new Error('Invalid protected-secret payload', { cause: payload.error });
		}
		return payload.data.secret;
	} finally {
		contentKey.fill(0);
		nonce.fill(0);
		aad.fill(0);
		ciphertext.fill(0);
		plaintext?.fill(0);
	}
}
