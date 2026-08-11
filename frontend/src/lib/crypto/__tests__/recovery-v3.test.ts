import { afterEach, describe, expect, it } from 'vitest';
import {
	assertRecoveryEnvelopeFitsNostrCapsule,
	buildProtectedSecretAad,
	createAuthenticatedRecoverySet,
	MAX_NOSTR_V3_RECOVERY_ENVELOPE_BYTES,
	MAX_RECOVERY_V3_CIPHERTEXT_BYTES,
	MAX_RECOVERY_V3_ENVELOPE_BYTES,
	MAX_RECOVERY_V3_SECRET_BYTES,
	MAX_RECOVERY_V3_TOTAL_SHARES,
	parseRecoveryShareEnvelope,
	recoverAuthenticatedSecret,
	serializeRecoveryShareEnvelope,
	validateRecoveryShareEnvelopeIntegrity
} from '../recovery-v3';

const originalCrypto = globalThis.crypto;

const KNOWN_ANSWER_SECRET = 'known-answer 🔐\nline two';
const KNOWN_ANSWER_ENVELOPES = [
	'{"scheme":"keyfate-shamir-chacha20poly1305","version":3,"setId":"000102030405060708090a0b0c0d0e0f","threshold":2,"total":3,"index":1,"shareHex":"08018b8a898887868584838281807f7e7d7d7b557956775b75587359715a6f476d446b4d694e67436540634161425f7f5d7c5b455946574b55485349514a4f574d544b5d495e47534550435141523f2f3d2c","protectedSecret":{"cipher":"chacha20-poly1305","nonceHex":"303132333435363738393a3b","ciphertextHex":"a66d55dcf56457ef248c3555b76380b574d780827d28b2d04b7fa23b593c93d21a36e8a5ccffd959ef94e11fd7630915910ef75fb26d0170ec2ccd6ba6841611e69014cd8873b2e228ee1ce98d91a607dc9bad145ae0035d8403c4328d3197032cff5e03b0dc7bc8","ciphertextDigestHex":"f2f6e3d12e5e8a94633feec320277872fbb7b25af2fc713cf18f634e54a708b0"}}',
	'{"scheme":"keyfate-shamir-chacha20poly1305","version":3,"setId":"000102030405060708090a0b0c0d0e0f","threshold":2,"total":3,"index":2,"shareHex":"08020b090f0d131117151b191f1dfefcfaf9f6dbf2deeec1eac4e6cfe2cadef5daf0d6f3d2f6cee9caecc6e7c2e2be9dba98b6abb2aeaeb1aab4a6bfa2ba9e859a80968392868e998a9c869782927e6d7a68","protectedSecret":{"cipher":"chacha20-poly1305","nonceHex":"303132333435363738393a3b","ciphertextHex":"a66d55dcf56457ef248c3555b76380b574d780827d28b2d04b7fa23b593c93d21a36e8a5ccffd959ef94e11fd7630915910ef75fb26d0170ec2ccd6ba6841611e69014cd8873b2e228ee1ce98d91a607dc9bad145ae0035d8403c4328d3197032cff5e03b0dc7bc8","ciphertextDigestHex":"f2f6e3d12e5e8a94633feec320277872fbb7b25af2fc713cf18f634e54a708b0"}}'
] as const;

function replaceHexByte(hex: string, byteIndex: number): string {
	const offset = byteIndex * 2;
	const original = Number.parseInt(hex.slice(offset, offset + 2), 16);
	const replacement = (original ^ 0x01).toString(16).padStart(2, '0');
	return `${hex.slice(0, offset)}${replacement}${hex.slice(offset + 2)}`;
}

function mutateEnvelope(
	serialized: string,
	mutate: (envelope: ReturnType<typeof parseRecoveryShareEnvelope>) => void
): string {
	const envelope = structuredClone(parseRecoveryShareEnvelope(serialized));
	mutate(envelope);
	return JSON.stringify(envelope);
}

describe('authenticated v3 recovery primitives', () => {
	afterEach(() => {
		Object.defineProperty(globalThis, 'crypto', {
			value: originalCrypto,
			configurable: true,
			writable: true
		});
	});

	it('round-trips a Unicode structured secret and splits only a 32-byte content key', () => {
		const secret = 'correct horse 🔐 電池 staple\nline two';
		const recoverySet = createAuthenticatedRecoverySet(secret, { threshold: 2, total: 3 });

		expect(recoverySet.setId).toMatch(/^[0-9a-f]{32}$/);
		expect(recoverySet.envelopes).toHaveLength(3);
		expect(
			new Set(recoverySet.envelopes.map((value) => parseRecoveryShareEnvelope(value).index))
		).toEqual(new Set([1, 2, 3]));
		for (const serialized of recoverySet.envelopes) {
			const envelope = parseRecoveryShareEnvelope(serialized);
			expect(envelope.shareHex).toHaveLength(164);
			expect(serialized).not.toContain(secret);
			expect(serialized).not.toContain('secretHash');
			expect(serialized).not.toContain('plaintextDigest');
		}

		expect(recoverAuthenticatedSecret(recoverySet.envelopes.slice(0, 2))).toBe(secret);
	});

	it('recovers the fixed v3 known-answer envelopes across future codec changes', () => {
		expect(recoverAuthenticatedSecret(KNOWN_ANSWER_ENVELOPES)).toBe(KNOWN_ANSWER_SECRET);
		for (const serialized of KNOWN_ANSWER_ENVELOPES) {
			expect(serializeRecoveryShareEnvelope(parseRecoveryShareEnvelope(serialized))).toBe(
				serialized
			);
		}
	});

	it('constructs deterministic domain-separated associated data', () => {
		const context = {
			setId: '0123456789abcdef0123456789abcdef',
			threshold: 2,
			total: 3
		};
		const first = buildProtectedSecretAad(context);
		const second = buildProtectedSecretAad({ ...context });

		expect(first).toEqual(second);
		expect(new TextDecoder().decode(first)).toBe(
			'{"domain":"keyfate/recovery-v3/protected-secret","scheme":"keyfate-shamir-chacha20poly1305","version":3,"setId":"0123456789abcdef0123456789abcdef","threshold":2,"total":3,"payloadFormat":"keyfate-protected-secret","payloadVersion":3,"cipher":"chacha20-poly1305"}'
		);
	});

	it('uses strict canonical JSON share envelopes', () => {
		const { envelopes } = createAuthenticatedRecoverySet('strict', { threshold: 2, total: 3 });
		const parsed = parseRecoveryShareEnvelope(envelopes[0]);
		expect(serializeRecoveryShareEnvelope(parsed)).toBe(envelopes[0]);

		const withUnknownField = JSON.stringify({ ...parsed, unexpected: true });
		expect(() => parseRecoveryShareEnvelope(withUnknownField)).toThrow('Invalid v3 share envelope');
		expect(() =>
			parseRecoveryShareEnvelope('{"scheme":"keyfate-shamir-chacha20poly1305"}')
		).toThrow('Invalid v3 share envelope');
		expect(() => parseRecoveryShareEnvelope('not json')).toThrow('Invalid v3 share envelope');
	});

	it('accepts the exact UTF-8 secret limit and rejects one byte over before randomness', () => {
		const exact = '🔐'.repeat(MAX_RECOVERY_V3_SECRET_BYTES / 4);
		const recoverySet = createAuthenticatedRecoverySet(exact, { threshold: 2, total: 2 });
		expect(recoverAuthenticatedSecret(recoverySet.envelopes)).toBe(exact);

		let randomCalls = 0;
		Object.defineProperty(globalThis, 'crypto', {
			value: {
				getRandomValues: <T extends ArrayBufferView>(array: T): T => {
					randomCalls += 1;
					return array;
				}
			},
			configurable: true,
			writable: true
		});
		expect(() => createAuthenticatedRecoverySet(`${exact}b`, { threshold: 2, total: 2 })).toThrow(
			'maximum UTF-8 length'
		);
		expect(randomCalls).toBe(0);
	});

	it('accepts worst-case JSON escaping at the exact ciphertext boundary', () => {
		const secret = '\0'.repeat(MAX_RECOVERY_V3_SECRET_BYTES);
		const recoverySet = createAuthenticatedRecoverySet(secret, { threshold: 2, total: 2 });
		const envelope = parseRecoveryShareEnvelope(recoverySet.envelopes[0]);
		expect(envelope.protectedSecret.ciphertextHex).toHaveLength(
			MAX_RECOVERY_V3_CIPHERTEXT_BYTES * 2
		);
		expect(recoverAuthenticatedSecret(recoverySet.envelopes)).toBe(secret);
	});

	it('bounds ciphertext hex at the exact protocol maximum', () => {
		const { envelopes } = createAuthenticatedRecoverySet('bounded', { threshold: 2, total: 2 });
		const exact = mutateEnvelope(envelopes[0], (envelope) => {
			envelope.protectedSecret.ciphertextHex = '00'.repeat(MAX_RECOVERY_V3_CIPHERTEXT_BYTES);
		});
		expect(parseRecoveryShareEnvelope(exact).protectedSecret.ciphertextHex).toHaveLength(
			MAX_RECOVERY_V3_CIPHERTEXT_BYTES * 2
		);

		const oversized = mutateEnvelope(envelopes[0], (envelope) => {
			envelope.protectedSecret.ciphertextHex = '00'.repeat(MAX_RECOVERY_V3_CIPHERTEXT_BYTES + 1);
		});
		expect(() => parseRecoveryShareEnvelope(oversized)).toThrow('Invalid v3 share envelope');
	});

	it('rejects an oversized serialized envelope before JSON parsing', () => {
		const { envelopes } = createAuthenticatedRecoverySet('bounded', { threshold: 2, total: 2 });
		const utf8Length = new TextEncoder().encode(envelopes[0]).length;
		const exact = envelopes[0] + ' '.repeat(MAX_RECOVERY_V3_ENVELOPE_BYTES - utf8Length);
		expect(parseRecoveryShareEnvelope(exact).index).toBe(1);
		expect(() => parseRecoveryShareEnvelope(`${exact} `)).toThrow(
			'v3 share envelope exceeds maximum size'
		);
	});

	it('checks the conservative nested Nostr gift-wrap boundary using UTF-8 bytes', () => {
		expect(() =>
			assertRecoveryEnvelopeFitsNostrCapsule('a'.repeat(MAX_NOSTR_V3_RECOVERY_ENVELOPE_BYTES))
		).not.toThrow();
		expect(() =>
			assertRecoveryEnvelopeFitsNostrCapsule('a'.repeat(MAX_NOSTR_V3_RECOVERY_ENVELOPE_BYTES + 1))
		).toThrow('safe nested Nostr gift-wrap limit');

		const exactUnicode = '🔐'.repeat(MAX_NOSTR_V3_RECOVERY_ENVELOPE_BYTES / 4);
		expect(new TextEncoder().encode(exactUnicode)).toHaveLength(
			MAX_NOSTR_V3_RECOVERY_ENVELOPE_BYTES
		);
		expect(() => assertRecoveryEnvelopeFitsNostrCapsule(exactUnicode)).not.toThrow();
		expect(() => assertRecoveryEnvelopeFitsNostrCapsule(`${exactUnicode}a`)).toThrow(
			'safe nested Nostr gift-wrap limit'
		);
	});

	it('validates that the protected ciphertext digest matches the ciphertext', () => {
		const { envelopes } = createAuthenticatedRecoverySet('digest boundary', {
			threshold: 2,
			total: 3
		});
		expect(validateRecoveryShareEnvelopeIntegrity(envelopes[0]).index).toBe(1);

		const tampered = mutateEnvelope(envelopes[0], (envelope) => {
			envelope.protectedSecret.ciphertextDigestHex = '00'.repeat(32);
		});
		expect(() => validateRecoveryShareEnvelopeIntegrity(tampered)).toThrow(
			'Protected-secret ciphertext digest does not match'
		);
	});

	it('bounds submitted envelope count before bulk parsing and by declared total', () => {
		const atMaximum = createAuthenticatedRecoverySet('maximum count', {
			threshold: 2,
			total: MAX_RECOVERY_V3_TOTAL_SHARES
		});
		expect(recoverAuthenticatedSecret(atMaximum.envelopes)).toBe('maximum count');

		const tooMany = Array.from({ length: MAX_RECOVERY_V3_TOTAL_SHARES + 1 }, () => 'not json');
		expect(() => recoverAuthenticatedSecret(tooMany)).toThrow(
			'v3 recovery share count exceeds protocol maximum'
		);

		const { envelopes } = createAuthenticatedRecoverySet('bounded', { threshold: 2, total: 3 });
		expect(() =>
			recoverAuthenticatedSecret([envelopes[0], 'not json', 'not json', 'not json'])
		).toThrow('v3 recovery share count exceeds declared total');
	});

	it('rejects insufficient shares', () => {
		const { envelopes } = createAuthenticatedRecoverySet('secret', { threshold: 2, total: 3 });
		expect(() => recoverAuthenticatedSecret([envelopes[0]])).toThrow('at least 2 distinct shares');
	});

	it('rejects duplicate indices', () => {
		const { envelopes } = createAuthenticatedRecoverySet('secret', { threshold: 2, total: 3 });
		expect(() => recoverAuthenticatedSecret([envelopes[0], envelopes[0]])).toThrow(
			'Duplicate share index'
		);
	});

	it('rejects mixed recovery sets', () => {
		const first = createAuthenticatedRecoverySet('first', { threshold: 2, total: 3 });
		const second = createAuthenticatedRecoverySet('second', { threshold: 2, total: 3 });
		expect(() => recoverAuthenticatedSecret([first.envelopes[0], second.envelopes[1]])).toThrow(
			'Recovery share metadata does not match'
		);
	});

	it('rejects a wrapper index that does not match the embedded Shamir identifier', () => {
		const { envelopes } = createAuthenticatedRecoverySet('secret', { threshold: 2, total: 3 });
		const changed = mutateEnvelope(envelopes[0], (envelope) => {
			envelope.index = 3;
		});
		expect(() => recoverAuthenticatedSecret([changed, envelopes[1]])).toThrow(
			'does not match embedded Shamir identifier'
		);
	});

	it('rejects threshold and total metadata mutation', () => {
		const { envelopes } = createAuthenticatedRecoverySet('secret', { threshold: 2, total: 3 });
		const wrongThreshold = mutateEnvelope(envelopes[1], (envelope) => {
			envelope.threshold = 3;
		});
		expect(() => recoverAuthenticatedSecret([envelopes[0], wrongThreshold])).toThrow(
			'Recovery share metadata does not match'
		);

		const wrongTotal = envelopes.slice(0, 2).map((serialized) =>
			mutateEnvelope(serialized, (envelope) => {
				envelope.total = 4;
			})
		);
		expect(() => recoverAuthenticatedSecret(wrongTotal)).toThrow();
	});

	it('rejects a share-bit mutation through authenticated decryption', () => {
		const { envelopes } = createAuthenticatedRecoverySet('secret', { threshold: 2, total: 3 });
		const changed = mutateEnvelope(envelopes[0], (envelope) => {
			envelope.shareHex = replaceHexByte(envelope.shareHex, 10);
		});
		expect(() => recoverAuthenticatedSecret([changed, envelopes[1]])).toThrow();
	});

	it('rejects ciphertext, nonce, and digest tampering', () => {
		const { envelopes } = createAuthenticatedRecoverySet('secret', { threshold: 2, total: 3 });
		for (const field of ['ciphertextHex', 'nonceHex', 'ciphertextDigestHex'] as const) {
			const changed = envelopes.slice(0, 2).map((serialized) =>
				mutateEnvelope(serialized, (envelope) => {
					envelope.protectedSecret[field] = replaceHexByte(envelope.protectedSecret[field], 0);
				})
			);
			expect(() => recoverAuthenticatedSecret(changed)).toThrow();
		}
	});

	it('never treats invalid v3-looking input as a legacy share', () => {
		const invalidV3 = JSON.stringify({
			scheme: 'keyfate-shamir-chacha20poly1305',
			version: 3,
			shareHex: '0801abcd'
		});
		expect(() => recoverAuthenticatedSecret([invalidV3, invalidV3])).toThrow(
			'Invalid v3 share envelope'
		);
	});

	it('fails closed when Web Crypto randomness is absent', () => {
		Object.defineProperty(globalThis, 'crypto', {
			value: undefined,
			configurable: true,
			writable: true
		});
		expect(() => createAuthenticatedRecoverySet('secret', { threshold: 2, total: 3 })).toThrow(
			'Secure random number generator unavailable'
		);
	});

	it('fails closed when Web Crypto randomness throws', () => {
		Object.defineProperty(globalThis, 'crypto', {
			value: {
				getRandomValues: () => {
					throw new Error('rng failed');
				}
			},
			configurable: true,
			writable: true
		});
		expect(() => createAuthenticatedRecoverySet('secret', { threshold: 2, total: 3 })).toThrow(
			'Secure random number generator failed'
		);
	});

	it('zeroes a captured content key when nonce generation fails', () => {
		let call = 0;
		let capturedKey: Uint8Array | undefined;
		Object.defineProperty(globalThis, 'crypto', {
			value: {
				getRandomValues: <T extends ArrayBufferView>(array: T): T => {
					call += 1;
					const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
					bytes.fill(call);
					if (call === 2) capturedKey = bytes;
					if (call === 3) throw new Error('nonce rng failed');
					return array;
				}
			},
			configurable: true,
			writable: true
		});

		expect(() => createAuthenticatedRecoverySet('secret', { threshold: 2, total: 3 })).toThrow(
			'Secure random number generator failed'
		);
		expect(capturedKey).toBeDefined();
		expect(capturedKey?.every((byte) => byte === 0)).toBe(true);
	});

	it('pre-generates all polynomial entropy in one Web Crypto call before splitting', () => {
		const requestedLengths: number[] = [];
		Object.defineProperty(globalThis, 'crypto', {
			value: {
				getRandomValues: <T extends ArrayBufferView>(array: T): T => {
					requestedLengths.push(array.byteLength);
					new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(
						requestedLengths.length
					);
					return array;
				}
			},
			configurable: true,
			writable: true
		});

		const recoverySet = createAuthenticatedRecoverySet('pre-generated', {
			threshold: 3,
			total: 4
		});
		expect(requestedLengths).toEqual([16, 32, 12, 160]);
		expect(recoverAuthenticatedSecret(recoverySet.envelopes.slice(0, 3))).toBe('pre-generated');
	});

	it('pre-generates polynomial entropy before splitting and can retry after its RNG failure', () => {
		let call = 0;
		let capturedKey: Uint8Array | undefined;
		Object.defineProperty(globalThis, 'crypto', {
			value: {
				getRandomValues: <T extends ArrayBufferView>(array: T): T => {
					call += 1;
					const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
					bytes.fill(call);
					if (call === 2) capturedKey = bytes;
					if (call === 4) throw new Error('polynomial rng failed');
					return array;
				}
			},
			configurable: true,
			writable: true
		});

		expect(() => createAuthenticatedRecoverySet('first', { threshold: 2, total: 3 })).toThrow(
			'Secure random number generator failed'
		);
		expect(capturedKey?.every((byte) => byte === 0)).toBe(true);

		Object.defineProperty(globalThis, 'crypto', {
			value: originalCrypto,
			configurable: true,
			writable: true
		});
		const retry = createAuthenticatedRecoverySet('retry succeeds', { threshold: 2, total: 3 });
		expect(recoverAuthenticatedSecret(retry.envelopes.slice(0, 2))).toBe('retry succeeds');
	});
});
