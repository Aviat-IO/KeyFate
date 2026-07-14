/**
 * Core logic for the confirm-utxos cron job.
 *
 * Checks pending Bitcoin UTXOs against mempool.space and updates
 * their status to "confirmed" when the transaction is mined.
 */

import { getDatabase } from '$lib/db/get-database';
import { bitcoinUtxos } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '$lib/logger';
import { getUTXOStatus } from '$lib/bitcoin/broadcast';
import { isBitcoinNetwork } from '$lib/bitcoin/network';
import { getP2WSHOutputScript } from '$lib/bitcoin/script';
import { hex } from '@scure/base';

/** Max UTXOs to process per run to avoid hammering mempool.space */
export const MAX_UTXOS_PER_RUN = 10;

export interface ConfirmUtxosResult {
	success: boolean;
	processed: number;
	succeeded: number;
	failed: number;
	stillPending: number;
	message?: string;
	errors?: string[];
}

export async function confirmPendingUtxos(
	getStatus: typeof getUTXOStatus = getUTXOStatus
): Promise<ConfirmUtxosResult> {
	const db = await getDatabase();

	// Query all pending UTXOs, limited to MAX_UTXOS_PER_RUN
	const pendingUtxos = await db
		.select()
		.from(bitcoinUtxos)
		.where(eq(bitcoinUtxos.status, 'pending'))
		.limit(MAX_UTXOS_PER_RUN);

	if (pendingUtxos.length === 0) {
		return {
			success: true,
			processed: 0,
			succeeded: 0,
			failed: 0,
			stillPending: 0,
			message: 'No pending UTXOs to check'
		};
	}

	let confirmed = 0;
	let stillPending = 0;
	let failed = 0;
	const errors: string[] = [];

	for (const utxo of pendingUtxos) {
		try {
			if (!isBitcoinNetwork(utxo.network))
				throw new Error('UTXO has no recognized Bitcoin network');
			const expectedScriptPubKey = hex.encode(
				getP2WSHOutputScript(hex.decode(utxo.timelockScript), utxo.network)
			);
			const status = await getStatus(utxo.txId, utxo.outputIndex, utxo.network, {
				amountSats: utxo.amountSats,
				scriptPubKey: expectedScriptPubKey
			});
			if (status.spent) throw new Error('Persisted Bitcoin outpoint is already spent');

			if (status.confirmed) {
				await db
					.update(bitcoinUtxos)
					.set({
						status: 'confirmed',
						confirmedAt: new Date(),
						updatedAt: new Date()
					})
					.where(eq(bitcoinUtxos.id, utxo.id));

				confirmed++;
			} else {
				stillPending++;
			}
		} catch (error) {
			failed++;
			const message = error instanceof Error ? error.message : String(error);
			errors.push(`UTXO ${utxo.id} (tx: ${utxo.txId}): ${message}`);
			logger.error(
				'Failed to check UTXO status',
				error instanceof Error ? error : new Error(message),
				{
					utxoId: utxo.id,
					txId: utxo.txId
				}
			);
		}
	}

	logger.info('UTXO confirmation check completed', {
		processed: pendingUtxos.length,
		confirmed,
		stillPending,
		failed
	});

	return {
		success: true,
		processed: pendingUtxos.length,
		succeeded: confirmed,
		failed,
		stillPending,
		...(errors.length > 0 && { errors })
	};
}
