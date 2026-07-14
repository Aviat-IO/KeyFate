import * as btc from '@scure/btc-signer';
import { z } from 'zod';

export const BITCOIN_NETWORKS = ['mainnet', 'testnet', 'signet'] as const;

export type BitcoinNetwork = (typeof BITCOIN_NETWORKS)[number];

export const bitcoinNetworkSchema = z.enum(BITCOIN_NETWORKS);

export function getBitcoinNetworkParams(
	network: BitcoinNetwork
): typeof btc.NETWORK | typeof btc.TEST_NETWORK {
	return network === 'mainnet' ? btc.NETWORK : btc.TEST_NETWORK;
}

export function isBitcoinNetwork(value: string | null | undefined): value is BitcoinNetwork {
	return value === 'mainnet' || value === 'testnet' || value === 'signet';
}

export function getBitcoinExplorerBaseUrl(network: BitcoinNetwork): string {
	switch (network) {
		case 'mainnet':
			return 'https://mempool.space/api';
		case 'testnet':
			return 'https://mempool.space/testnet/api';
		case 'signet':
			return 'https://mempool.space/signet/api';
	}
}

export function getBitcoinBroadcastUrls(network: BitcoinNetwork): string[] {
	const mempool = `${getBitcoinExplorerBaseUrl(network)}/tx`;
	if (network === 'signet') return [mempool];
	const path = network === 'mainnet' ? '' : '/testnet';
	return [mempool, `https://blockstream.info${path}/api/tx`];
}

export function getBitcoinStatusBaseUrls(network: BitcoinNetwork): string[] {
	const mempool = getBitcoinExplorerBaseUrl(network);
	if (network === 'signet') return [mempool];
	const path = network === 'mainnet' ? '' : '/testnet';
	return [mempool, `https://blockstream.info${path}/api`];
}
