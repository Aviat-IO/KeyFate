import { describe, expect, it } from 'vitest';
import { isBitcoinEnrollmentEnabled } from '$lib/server/bitcoin-enrollment';

describe('server-owned Bitcoin enrollment gate', () => {
	it('is fail-closed unless both explicit values authorize Signet', () => {
		expect(isBitcoinEnrollmentEnabled({})).toBe(false);
		expect(
			isBitcoinEnrollmentEnabled({ BITCOIN_ENROLLMENT_ENABLED: 'true', BITCOIN_NETWORK: 'testnet' })
		).toBe(false);
		expect(
			isBitcoinEnrollmentEnabled({ BITCOIN_ENROLLMENT_ENABLED: 'false', BITCOIN_NETWORK: 'signet' })
		).toBe(false);
		expect(
			isBitcoinEnrollmentEnabled({
				BITCOIN_ENROLLMENT_ENABLED: 'true',
				BITCOIN_NETWORK: 'signet'
			})
		).toBe(false);
		expect(
			isBitcoinEnrollmentEnabled({
				BITCOIN_ENROLLMENT_ENABLED: 'true',
				BITCOIN_NETWORK: 'signet',
				RAILWAY_ENVIRONMENT_NAME: 'staging'
			})
		).toBe(true);
		expect(
			isBitcoinEnrollmentEnabled({
				BITCOIN_ENROLLMENT_ENABLED: 'true',
				BITCOIN_NETWORK: 'signet',
				RAILWAY_ENVIRONMENT_NAME: 'production'
			})
		).toBe(false);
	});
});
