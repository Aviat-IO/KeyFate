import { describe, expect, it } from 'vitest';
import { createAuthenticatedRecoverySet } from '../crypto/recovery-v3';
import { validateServerShareBoundary } from './recovery-v3-boundary';

describe('v3 server-share creation boundary', () => {
	it('accepts exactly the index-1 envelope matching the request context', () => {
		const secret = 'Unicode server boundary 🔐 電池';
		const { envelopes } = createAuthenticatedRecoverySet(secret, { threshold: 2, total: 3 });

		expect(
			validateServerShareBoundary({
				serverShare: envelopes[0],
				threshold: 2,
				total: 3
			})
		).toEqual({ mode: 'authenticated-v3', envelopeIndex: 1 });
		expect(envelopes[0]).not.toContain(secret);
	});

	it('rejects malformed, wrong-index, and mismatched-context plaintext-equivalent shares', () => {
		const { envelopes } = createAuthenticatedRecoverySet('secret', { threshold: 2, total: 3 });

		expect(() =>
			validateServerShareBoundary({ serverShare: 'legacy-hex', threshold: 2, total: 3 })
		).toThrow('strict authenticated v3');
		expect(() =>
			validateServerShareBoundary({ serverShare: envelopes[1], threshold: 2, total: 3 })
		).toThrow('index 1');
		const forgedWrapper = JSON.parse(envelopes[1]) as { index: number };
		forgedWrapper.index = 1;
		expect(() =>
			validateServerShareBoundary({
				serverShare: JSON.stringify(forgedWrapper),
				threshold: 2,
				total: 3
			})
		).toThrow('actual index 1');
		expect(() =>
			validateServerShareBoundary({ serverShare: envelopes[0], threshold: 2, total: 4 })
		).toThrow('request threshold and total');
	});

	it('rejects higher-threshold v3 envelopes even when their metadata is otherwise valid', () => {
		const { envelopes } = createAuthenticatedRecoverySet('secret', { threshold: 3, total: 4 });
		expect(() =>
			validateServerShareBoundary({ serverShare: envelopes[0], threshold: 3, total: 4 })
		).toThrow('requires a threshold of 2');
	});

	it('rejects a ciphertext digest that does not authenticate the protected ciphertext', () => {
		const { envelopes } = createAuthenticatedRecoverySet('secret', { threshold: 2, total: 3 });
		const tampered = JSON.parse(envelopes[0]) as {
			protectedSecret: { ciphertextDigestHex: string };
		};
		tampered.protectedSecret.ciphertextDigestHex = '00'.repeat(32);

		expect(() =>
			validateServerShareBoundary({
				serverShare: JSON.stringify(tampered),
				threshold: 2,
				total: 3
			})
		).toThrow('ciphertext digest');
	});
});
