import { describe, expect, it, vi } from 'vitest';
import * as btc from '@scure/btc-signer';
import {
	getBitcoinBroadcastUrls,
	getBitcoinExplorerBaseUrl,
	getBitcoinNetworkParams,
	getBitcoinStatusBaseUrls
} from '$lib/bitcoin/network';
import { discoverAddressUtxos, UTXO_DISCOVERY_LIMITS } from '$lib/bitcoin/utxo-discovery';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { hex } from '@scure/base';

const privateKey = new Uint8Array(32);
privateKey[31] = 1;
const ownerPayment = btc.p2wpkh(secp256k1.getPublicKey(privateKey, true), btc.TEST_NETWORK);
const address = ownerPayment.address!;
const ownerScriptPubKey = hex.encode(ownerPayment.script);

describe('native Signet network routing', () => {
	it('uses testnet address rules without aliasing the network value', () => {
		expect(getBitcoinNetworkParams('signet')).toBe(btc.TEST_NETWORK);
		expect(getBitcoinExplorerBaseUrl('signet')).toBe('https://mempool.space/signet/api');
		expect(() => btc.Address(getBitcoinNetworkParams('signet')).decode(address)).not.toThrow();
	});

	it('routes broadcast and status only through native Signet endpoints', () => {
		expect(getBitcoinBroadcastUrls('signet')).toEqual(['https://mempool.space/signet/api/tx']);
		expect(getBitcoinStatusBaseUrls('signet')).toEqual(['https://mempool.space/signet/api']);
	});
});

describe('bounded exact-address Signet discovery', () => {
	it('returns only confirmed outputs proven to pay the exact owner address', async () => {
		const txid = 'ab'.repeat(32);
		const fetchMock = vi.fn(async (input: string | URL | Request) => {
			const url = String(input);
			if (url.endsWith('/utxo'))
				return new Response(
					JSON.stringify([
						{ txid, vout: 0, value: 25000, status: { confirmed: true } },
						{ txid: 'cd'.repeat(32), vout: 1, value: 10000, status: { confirmed: false } }
					])
				);
			return new Response(
				JSON.stringify({
					vout: [{ scriptpubkey: ownerScriptPubKey, scriptpubkey_address: address, value: 25000 }]
				})
			);
		});
		const result = await discoverAddressUtxos({
			address,
			network: 'signet',
			fetchImplementation: fetchMock as unknown as typeof fetch
		});
		expect(result).toEqual([
			{ txId: txid, outputIndex: 0, amountSats: 25000, scriptPubKey: ownerScriptPubKey }
		]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('rejects explorer outpoints that do not pay the exact address', async () => {
		const fetchMock = vi.fn(async (input: string | URL | Request) =>
			String(input).endsWith('/utxo')
				? new Response(
						JSON.stringify([
							{ txid: 'ab'.repeat(32), vout: 0, value: 25000, status: { confirmed: true } }
						])
					)
				: new Response(
						JSON.stringify({
							vout: [
								{
									scriptpubkey: ownerScriptPubKey,
									scriptpubkey_address: address + 'x',
									value: 25000
								}
							]
						})
					)
		);
		await expect(
			discoverAddressUtxos({
				address,
				network: 'signet',
				fetchImplementation: fetchMock as unknown as typeof fetch
			})
		).rejects.toThrow('does not exactly match');
	});

	it('rejects oversized response bodies and non-Signet discovery', async () => {
		const fetchMock = vi.fn(
			async () => new Response(' '.repeat(UTXO_DISCOVERY_LIMITS.maxResponseBytes + 1))
		);
		await expect(
			discoverAddressUtxos({
				address,
				network: 'signet',
				fetchImplementation: fetchMock as unknown as typeof fetch
			})
		).rejects.toThrow('too large');
		await expect(discoverAddressUtxos({ address, network: 'testnet' })).rejects.toThrow(
			'restricted to Signet'
		);
	});
});
