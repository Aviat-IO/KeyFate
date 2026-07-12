/** Read-only Bitcoin lifecycle queries. Signing and private-key operations are browser-only. */

import { and, desc, eq } from 'drizzle-orm';
import { getDatabase } from '$lib/db/drizzle';
import { bitcoinUtxos, secrets, type BitcoinUtxo } from '$lib/db/schema';
import { estimateRefreshesRemaining } from '$lib/bitcoin/refresh';
import { blocksToApproxDays } from '$lib/bitcoin/script';

export interface BitcoinStatus {
	enabled: boolean;
	utxo: {
		id: string;
		txId: string;
		outputIndex: number;
		amountSats: number;
		ttlBlocks: number;
		status: string;
		confirmedAt: Date | null;
		createdAt: Date;
		timelockScript: string;
		ownerPubkey: string;
		branchPubkey: string;
		generation: number;
	} | null;
	estimatedDaysRemaining: number | null;
	refreshesRemaining: number | null;
	/** Compatibility name; true means a recipient-encrypted v2 envelope exists. */
	hasPreSignedTx: boolean;
	network: 'mainnet' | 'testnet' | null;
}

export function buildBitcoinStatus(latestUtxo?: BitcoinUtxo): BitcoinStatus {
	if (!latestUtxo) {
		return {
			enabled: false,
			utxo: null,
			estimatedDaysRemaining: null,
			refreshesRemaining: null,
			hasPreSignedTx: false,
			network: null
		};
	}

	const active = latestUtxo.status === 'confirmed' || latestUtxo.status === 'pending';
	const network =
		latestUtxo.network === 'mainnet' || latestUtxo.network === 'testnet'
			? latestUtxo.network
			: null;
	return {
		enabled: true,
		utxo: {
			id: latestUtxo.id,
			txId: latestUtxo.txId,
			outputIndex: latestUtxo.outputIndex,
			amountSats: latestUtxo.amountSats,
			ttlBlocks: latestUtxo.ttlBlocks,
			status: latestUtxo.status,
			confirmedAt: latestUtxo.confirmedAt,
			createdAt: latestUtxo.createdAt,
			timelockScript: latestUtxo.timelockScript,
			ownerPubkey: latestUtxo.ownerPubkey,
			branchPubkey: latestUtxo.recipientPubkey,
			generation: latestUtxo.generation
		},
		estimatedDaysRemaining: active ? blocksToApproxDays(latestUtxo.ttlBlocks) : null,
		refreshesRemaining: active ? estimateRefreshesRemaining(latestUtxo.amountSats, 10) : null,
		hasPreSignedTx: Boolean(latestUtxo.encryptedRecoveryTx),
		network
	};
}

export async function getBitcoinStatus(secretId: string, userId: string): Promise<BitcoinStatus> {
	const db = await getDatabase();
	const [secret] = await db
		.select({ id: secrets.id })
		.from(secrets)
		.where(and(eq(secrets.id, secretId), eq(secrets.userId, userId)));
	if (!secret) throw new Error('Secret not found');

	const [latestUtxo] = await db
		.select()
		.from(bitcoinUtxos)
		.where(eq(bitcoinUtxos.secretId, secretId))
		.orderBy(desc(bitcoinUtxos.generation));
	return buildBitcoinStatus(latestUtxo);
}

export async function getActiveUtxo(secretId: string): Promise<BitcoinUtxo | null> {
	const db = await getDatabase();
	const [utxo] = await db
		.select()
		.from(bitcoinUtxos)
		.where(and(eq(bitcoinUtxos.secretId, secretId), eq(bitcoinUtxos.status, 'confirmed')))
		.orderBy(desc(bitcoinUtxos.generation));
	return utxo ?? null;
}
