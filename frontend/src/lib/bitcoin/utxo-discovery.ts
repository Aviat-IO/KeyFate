import { z } from 'zod';
import { hex } from '@scure/base';
import type { UTXO } from './transaction.js';
import {
	getBitcoinExplorerBaseUrl,
	getBitcoinNetworkParams,
	type BitcoinNetwork
} from './network.js';
import * as btc from '@scure/btc-signer';

const MAX_RESPONSE_BYTES = 256_000;
const MAX_UTXOS = 50;
const REQUEST_TIMEOUT_MS = 8_000;

const explorerUtxosSchema = z
	.array(
		z
			.object({
				txid: z.string().regex(/^[0-9a-f]{64}$/),
				vout: z.number().int().nonnegative(),
				value: z.number().int().positive(),
				status: z.object({ confirmed: z.boolean() }).passthrough()
			})
			.strict()
	)
	.max(MAX_UTXOS);

const transactionSchema = z
	.object({
		vout: z
			.array(
				z
					.object({
						scriptpubkey: z.string().regex(/^(?:[0-9a-f]{2})+$/),
						scriptpubkey_address: z.string().optional(),
						value: z.number().int().positive()
					})
					.passthrough()
			)
			.max(10_000)
	})
	.passthrough();

async function boundedJson(url: string, fetchImplementation: typeof fetch): Promise<unknown> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetchImplementation(url, {
			headers: { Accept: 'application/json' },
			signal: controller.signal
		});
		if (!response.ok) throw new Error(`Signet explorer returned HTTP ${response.status}`);
		const contentLength = Number(response.headers.get('content-length') ?? 0);
		if (contentLength > MAX_RESPONSE_BYTES)
			throw new Error('Signet explorer response is too large');
		const text = await response.text();
		if (new TextEncoder().encode(text).length > MAX_RESPONSE_BYTES) {
			throw new Error('Signet explorer response is too large');
		}
		return JSON.parse(text) as unknown;
	} finally {
		clearTimeout(timeout);
	}
}

export async function discoverAddressUtxos(params: {
	address: string;
	network: BitcoinNetwork;
	fetchImplementation?: typeof fetch;
}): Promise<UTXO[]> {
	if (params.network !== 'signet')
		throw new Error('Owner funding discovery is restricted to Signet');
	const addressCoder = btc.Address(getBitcoinNetworkParams(params.network));
	const decodedAddress = addressCoder.decode(params.address);
	if (!decodedAddress) throw new Error('Owner funding address is invalid');
	const expectedScriptPubKey = hex.encode(btc.OutScript.encode(decodedAddress));
	const fetchImplementation = params.fetchImplementation ?? fetch;
	const baseUrl = getBitcoinExplorerBaseUrl(params.network);
	const candidates = explorerUtxosSchema.parse(
		await boundedJson(
			`${baseUrl}/address/${encodeURIComponent(params.address)}/utxo`,
			fetchImplementation
		)
	);
	const spendable: UTXO[] = [];
	for (const candidate of candidates) {
		if (!candidate.status.confirmed) continue;
		const transaction = transactionSchema.parse(
			await boundedJson(`${baseUrl}/tx/${candidate.txid}`, fetchImplementation)
		);
		const output = transaction.vout[candidate.vout];
		if (
			!output ||
			output.scriptpubkey !== expectedScriptPubKey ||
			output.value !== candidate.value ||
			(output.scriptpubkey_address !== undefined && output.scriptpubkey_address !== params.address)
		) {
			throw new Error(
				'Signet explorer returned an outpoint that does not exactly match the owner output'
			);
		}
		spendable.push({
			txId: candidate.txid,
			outputIndex: candidate.vout,
			amountSats: candidate.value,
			scriptPubKey: output.scriptpubkey
		});
	}
	return spendable;
}

export const UTXO_DISCOVERY_LIMITS = {
	maxResponseBytes: MAX_RESPONSE_BYTES,
	maxUtxos: MAX_UTXOS,
	requestTimeoutMs: REQUEST_TIMEOUT_MS
} as const;
