/** Transaction broadcasting and status lookup via bounded public Bitcoin APIs. */

import { z } from 'zod';
import {
	getBitcoinBroadcastUrls,
	getBitcoinStatusBaseUrls,
	type BitcoinNetwork
} from './network.js';

export interface UTXOStatus {
	confirmed: boolean;
	blockHeight?: number;
	spent: boolean;
	spentByTxId?: string;
}

export interface ExpectedUTXO {
	amountSats: number;
	scriptPubKey: string;
}

const TXID_PATTERN = /^[0-9a-f]{64}$/;
const BITCOIN_REQUEST_TIMEOUT_MS = 8_000;

const transactionStatusSchema = z
	.object({
		status: z
			.object({
				confirmed: z.boolean(),
				block_height: z.number().int().nonnegative().optional()
			})
			.passthrough(),
		vout: z.array(
			z
				.object({
					value: z.number().int().nonnegative(),
					scriptpubkey: z.string().regex(/^(?:[0-9a-f]{2})+$/)
				})
				.passthrough()
		)
	})
	.passthrough();

const outspendSchema = z
	.object({
		spent: z.boolean(),
		txid: z.string().regex(TXID_PATTERN).optional()
	})
	.passthrough();

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), BITCOIN_REQUEST_TIMEOUT_MS);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
}

async function transactionIsKnown(txId: string, network: BitcoinNetwork): Promise<boolean> {
	for (const baseUrl of getBitcoinStatusBaseUrls(network)) {
		try {
			if ((await fetchWithTimeout(`${baseUrl}/tx/${txId}`)).ok) return true;
		} catch {
			// Try the next independently configured endpoint.
		}
	}
	return false;
}

export async function broadcastTransaction(
	txHex: string,
	network: BitcoinNetwork = 'mainnet',
	expectedTxId?: string
): Promise<string> {
	if (expectedTxId !== undefined && !TXID_PATTERN.test(expectedTxId)) {
		throw new Error('Expected transaction ID must be 64 lowercase hexadecimal characters');
	}
	const errors: string[] = [];
	for (const url of getBitcoinBroadcastUrls(network)) {
		try {
			const response = await fetchWithTimeout(url, {
				method: 'POST',
				headers: { 'Content-Type': 'text/plain' },
				body: txHex
			});
			const responseText = (await response.text()).trim();
			if (response.ok) {
				if (!TXID_PATTERN.test(responseText)) {
					throw new Error('broadcast endpoint returned a malformed transaction ID');
				}
				if (expectedTxId && responseText !== expectedTxId) {
					throw new Error('broadcast endpoint returned a different transaction ID');
				}
				return expectedTxId ?? responseText;
			}
			errors.push(
				`${new URL(url).hostname}: HTTP ${response.status} - ${responseText.slice(0, 512)}`
			);
		} catch (error) {
			errors.push(
				`${new URL(url).hostname}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}
	if (expectedTxId && (await transactionIsKnown(expectedTxId, network))) return expectedTxId;
	throw new Error(`Failed to broadcast transaction via all endpoints:\n${errors.join('\n')}`);
}

export async function getUTXOStatus(
	txId: string,
	outputIndex: number,
	network: BitcoinNetwork = 'mainnet',
	expected?: ExpectedUTXO
): Promise<UTXOStatus> {
	if (!TXID_PATTERN.test(txId) || !Number.isSafeInteger(outputIndex) || outputIndex < 0) {
		throw new Error('Invalid Bitcoin outpoint');
	}
	const errors: string[] = [];
	for (const baseUrl of getBitcoinStatusBaseUrls(network)) {
		try {
			const txResponse = await fetchWithTimeout(`${baseUrl}/tx/${txId}`);
			if (!txResponse.ok) {
				errors.push(`${new URL(baseUrl).hostname}: HTTP ${txResponse.status}`);
				continue;
			}
			const txData = transactionStatusSchema.parse(await txResponse.json());
			const output = txData.vout[outputIndex];
			if (!output) throw new Error('transaction output does not exist');
			if (
				expected &&
				(output.value !== expected.amountSats || output.scriptpubkey !== expected.scriptPubKey)
			) {
				throw new Error('transaction output does not match the persisted amount and script');
			}
			const outspendResponse = await fetchWithTimeout(
				`${baseUrl}/tx/${txId}/outspend/${outputIndex}`
			);
			if (!outspendResponse.ok) {
				errors.push(`${new URL(baseUrl).hostname}: outspend HTTP ${outspendResponse.status}`);
				continue;
			}
			const outspendData = outspendSchema.parse(await outspendResponse.json());
			return {
				confirmed: txData.status.confirmed,
				blockHeight: txData.status.block_height,
				spent: outspendData.spent,
				spentByTxId: outspendData.txid
			};
		} catch (error) {
			errors.push(
				`${new URL(baseUrl).hostname}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}
	throw new Error(`Failed to get UTXO status from all endpoints:\n${errors.join('\n')}`);
}
