import { describe, expect, it } from 'vitest';
import { buildBitcoinTimelockDemo } from '../bitcoin/timelock-demo';

const EXPECTED_SIGNET_VECTOR = {
	p2wshAddress: 'tb1qgzmrzku92ztk2dz4enl3xgrggtynhs0gphsat4m4yfh3d8dl0waqzjqfkw',
	p2wshScriptPubKeyHex: '002040b6315b855097653455ccff13206842c93bc1e80de1d5d775226f169dbf7bba',
	witnessScriptHex:
		'6321031f3800ebe1883a58030fe80088fad6a889527c3e57c6e832cdfe842c846112c5ac6702f003b2752103a380a59d1c5050a69d1b2f94871582ddc59e63897a0ccc13b64043b352a90efbac68'
};

describe('buildBitcoinTimelockDemo', () => {
	it('creates a deterministic signet/testnet CSV P2WSH vector', () => {
		const vector = buildBitcoinTimelockDemo();

		expect(vector.network).toBe('signet');
		expect(vector.ttlBlocks).toBe(1008);
		expect(vector.approxDays).toBe(7);
		expect(vector.amountSats).toBe(10_000);
		expect(vector.addressNetworkNote).toContain('tb1');
		expect(vector.p2wshAddress).toBe(EXPECTED_SIGNET_VECTOR.p2wshAddress);
		expect(vector.p2wshScriptPubKeyHex).toBe(EXPECTED_SIGNET_VECTOR.p2wshScriptPubKeyHex);
		expect(vector.witnessScriptHex).toBe(EXPECTED_SIGNET_VECTOR.witnessScriptHex);
		expect(vector.fundingOutput).toEqual({
			address: EXPECTED_SIGNET_VECTOR.p2wshAddress,
			amountSats: 10_000,
			scriptPubKeyHex: EXPECTED_SIGNET_VECTOR.p2wshScriptPubKeyHex
		});
	});

	it('uses testnet address parameters for signet and testnet', () => {
		const signet = buildBitcoinTimelockDemo({ network: 'signet' });
		const testnet = buildBitcoinTimelockDemo({ network: 'testnet' });

		expect(signet.p2wshAddress).toBe(testnet.p2wshAddress);
		expect(signet.p2wshAddress.startsWith('tb1')).toBe(true);
	});
});
