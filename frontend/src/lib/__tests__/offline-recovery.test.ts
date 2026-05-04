// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
	normalizeShareHex,
	parseOfflineShare,
	recoverOfflineSecret
} from '$lib/crypto/offline-recovery';

const DISCLOSED_SERVER_SHARE =
	'080107070706077507680773076407620771072707620769076e076b076107610768';

const RECIPIENT_SHARE =
	'08020e0e0e0f0e7c0e610e7a0e6d0e6b0e780e2e0e6b0e600e670e620e680e680e61';

// Static KeyFate recovery test vector generated with shamirs-secret-sharing 2.0.1:
// secret: "offline vector"
// threshold: 2, total shares: 3
// deterministic test PRNG byte: 0x07
// share 1 is the disclosed server share; share 2 is the recipient share.
const EXPECTED_SECRET = 'offline vector';

describe('offline recovery test vectors', () => {
	it('recovers a secret from recipient share plus disclosed server share', () => {
		const result = recoverOfflineSecret(RECIPIENT_SHARE, DISCLOSED_SERVER_SHARE);

		expect(result.secret).toBe(EXPECTED_SECRET);
		expect(result.sharesUsed).toEqual([RECIPIENT_SHARE, DISCLOSED_SERVER_SHARE]);
	});

	it('accepts JSON recovery kit shapes for both imports', () => {
		const recipientKit = JSON.stringify({ recipientShare: RECIPIENT_SHARE });
		const serverKit = JSON.stringify({ disclosedShare: DISCLOSED_SERVER_SHARE });

		expect(recoverOfflineSecret(recipientKit, serverKit).secret).toBe(EXPECTED_SECRET);
	});
});

describe('parseOfflineShare', () => {
	it('extracts common JSON share fields', () => {
		expect(parseOfflineShare(JSON.stringify({ server_share: DISCLOSED_SERVER_SHARE }))).toBe(
			DISCLOSED_SERVER_SHARE
		);
		expect(parseOfflineShare(JSON.stringify({ share: RECIPIENT_SHARE }))).toBe(RECIPIENT_SHARE);
	});

	it('normalizes whitespace without changing share bytes', () => {
		expect(normalizeShareHex(' ab cd ')).toBe('abcd');
		expect(normalizeShareHex('abc')).toBe('0abc');
	});

	it('rejects missing or non-hex shares', () => {
		expect(() => parseOfflineShare('')).toThrow('Share is required');
		expect(() => parseOfflineShare('not hex')).toThrow('Share must be hexadecimal');
		expect(() => parseOfflineShare('{"title":"no share"}')).toThrow('must contain one of');
	});

	it('rejects mismatched share lengths', () => {
		expect(() => recoverOfflineSecret(RECIPIENT_SHARE, 'abcd')).toThrow(
			'Shares are not the same length'
		);
	});
});
