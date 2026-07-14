/** Atomically persist a newer recipient-encrypted Bitcoin generation before superseding the old row. */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDatabase } from '$lib/db/drizzle';
import { bitcoinUtxos, checkinHistory, secretRecipients, secrets } from '$lib/db/schema';
import { requireCSRFProtection, createCSRFErrorResponse } from '$lib/csrf';
import { encryptedBitcoinEnvelopeSchema } from '$lib/bitcoin/recovery-envelope';
import { decodeCSVTimelockScript, MIN_UTXO_SATS } from '$lib/bitcoin/script';
import { isBitcoinEnrollmentEnabled } from '$lib/server/bitcoin-enrollment';
import { scheduleRemindersForSecret } from '$lib/services/reminder-scheduler';
import { logCheckIn } from '$lib/services/audit-logger';
import {
	bitcoinNetworkSchema,
	getBitcoinNetworkParams,
	type BitcoinNetwork
} from '$lib/bitcoin/network';

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const compressedPubkey = z.string().regex(/^(?:02|03)[0-9a-f]{64}$/);
const bodySchema = z
	.object({
		currentUtxoId: z.string().uuid(),
		newTxId: hex64,
		newOutputIndex: z.number().int().nonnegative(),
		newAmountSats: z.number().int().min(MIN_UTXO_SATS),
		newTimelockScript: z.string().regex(/^(?:[0-9a-f]{2})+$/),
		newBranchPubkey: compressedPubkey,
		ttlBlocks: z.number().int().min(1).max(65535),
		recipientAddress: z.string().min(14).max(100),
		network: bitcoinNetworkSchema,
		generation: z.number().int().min(2),
		nostrCapsuleEventId: hex64,
		encryptedRecoveryEnvelope: encryptedBitcoinEnvelopeSchema
	})
	.strict();

function validateAddress(address: string, network: BitcoinNetwork): void {
	btc.Address(getBitcoinNetworkParams(network)).decode(address);
}

export const POST: RequestHandler = async (event) => {
	const csrfCheck = await requireCSRFProtection(event);
	if (!csrfCheck.valid) return createCSRFErrorResponse();
	const session = await event.locals.auth();
	if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
	const userId = session.user.id;
	if (!isBitcoinEnrollmentEnabled()) {
		return json({ error: 'Bitcoin enrollment is disabled' }, { status: 503 });
	}

	const parsed = bodySchema.safeParse(await event.request.json());
	if (!parsed.success) {
		return json(
			{ error: 'Only recipient-encrypted Bitcoin v2 refresh artifacts are accepted' },
			{ status: 400 }
		);
	}

	try {
		const body = parsed.data;
		if (body.network !== 'signet') throw new Error('Bitcoin refresh is restricted to Signet');
		validateAddress(body.recipientAddress, body.network);
		const db = await getDatabase();
		const [secret] = await db
			.select({ id: secrets.id })
			.from(secrets)
			.where(and(eq(secrets.id, event.params.id), eq(secrets.userId, userId)));
		if (!secret) return json({ error: 'Secret not found' }, { status: 404 });

		const [current] = await db
			.select()
			.from(bitcoinUtxos)
			.where(
				and(
					eq(bitcoinUtxos.id, body.currentUtxoId),
					eq(bitcoinUtxos.secretId, event.params.id),
					inArray(bitcoinUtxos.status, ['pending', 'confirmed'])
				)
			);
		if (!current) return json({ error: 'Current Bitcoin generation not found' }, { status: 404 });
		if (
			body.generation !== current.generation + 1 ||
			body.network !== current.network ||
			body.recipientAddress !== current.recipientAddress ||
			body.nostrCapsuleEventId !==
				(current.recoveryManifest as { nostrCapsuleEventId?: string } | null)?.nostrCapsuleEventId
		) {
			throw new Error('Bitcoin refresh continuity binding mismatch');
		}

		const decodedScript = decodeCSVTimelockScript(hex.decode(body.newTimelockScript));
		if (
			hex.encode(decodedScript.ownerPubkey) !== current.ownerPubkey ||
			hex.encode(decodedScript.recipientPubkey) !== body.newBranchPubkey ||
			decodedScript.ttlBlocks !== body.ttlBlocks
		) {
			throw new Error('Refreshed timelock script binding mismatch');
		}
		if (
			body.encryptedRecoveryEnvelope.senderPubkey !== current.ownerPubkey.slice(2) ||
			body.encryptedRecoveryEnvelope.senderPubkey !== current.recoverySenderPubkey
		) {
			throw new Error('Recovery envelope sender continuity mismatch');
		}

		const recipientId = (current.recoveryManifest as { recipientId?: string } | null)?.recipientId;
		if (!recipientId) throw new Error('Current recovery manifest is incomplete');
		const [recipient] = await db
			.select({ nostrPubkey: secretRecipients.nostrPubkey })
			.from(secretRecipients)
			.where(
				and(eq(secretRecipients.id, recipientId), eq(secretRecipients.secretId, event.params.id))
			);
		if (recipient?.nostrPubkey !== body.encryptedRecoveryEnvelope.recipientNostrPubkey) {
			throw new Error('Recovery envelope recipient continuity mismatch');
		}

		const transition = await db.transaction(async (tx) => {
			const [lockedSecret] = await tx
				.select({
					id: secrets.id,
					checkInDays: secrets.checkInDays,
					status: secrets.status,
					triggeredAt: secrets.triggeredAt,
					processingLeaseId: secrets.processingLeaseId,
					processingLeaseExpiresAt: secrets.processingLeaseExpiresAt
				})
				.from(secrets)
				.where(and(eq(secrets.id, event.params.id), eq(secrets.userId, userId)))
				.for('update');
			if (!lockedSecret) return { kind: 'not_found' as const };

			const now = new Date();
			if (lockedSecret.triggeredAt || lockedSecret.status === 'triggered') {
				return { kind: 'already_disclosed' as const };
			}
			const hasLiveDisclosureLease =
				Boolean(lockedSecret.processingLeaseId) &&
				(!lockedSecret.processingLeaseExpiresAt || lockedSecret.processingLeaseExpiresAt > now);
			if (hasLiveDisclosureLease) return { kind: 'disclosure_in_progress' as const };

			const [newRecord] = await tx
				.insert(bitcoinUtxos)
				.values({
					secretId: event.params.id,
					txId: body.newTxId,
					outputIndex: body.newOutputIndex,
					amountSats: body.newAmountSats,
					timelockScript: body.newTimelockScript,
					ownerPubkey: current.ownerPubkey,
					recipientPubkey: body.newBranchPubkey,
					ttlBlocks: body.ttlBlocks,
					status: 'pending',
					preSignedRecipientTx: null,
					encryptedRecoveryTx: JSON.stringify(body.encryptedRecoveryEnvelope),
					recoverySenderPubkey: body.encryptedRecoveryEnvelope.senderPubkey,
					recipientAddress: body.recipientAddress,
					network: body.network,
					generation: body.generation,
					generationKey: `${event.params.id}:${body.generation}`,
					recoveryManifest: {
						recipientId,
						recipientNostrPubkey: recipient.nostrPubkey,
						nostrCapsuleEventId: body.nostrCapsuleEventId
					}
				})
				.returning();

			const superseded = await tx
				.update(bitcoinUtxos)
				.set({
					status: 'spent',
					spentAt: now,
					spentByTxId: body.newTxId,
					updatedAt: now
				})
				.where(
					and(
						eq(bitcoinUtxos.id, current.id),
						inArray(bitcoinUtxos.status, ['pending', 'confirmed'])
					)
				)
				.returning({ id: bitcoinUtxos.id });
			if (superseded.length !== 1) throw new Error('Bitcoin generation changed concurrently');

			const nextCheckIn = new Date(now.getTime() + lockedSecret.checkInDays * 24 * 60 * 60 * 1000);
			await tx
				.update(secrets)
				.set({
					lastCheckIn: now,
					nextCheckIn,
					status: lockedSecret.status === 'paused' ? 'paused' : 'active',
					processingStartedAt: null,
					processingLeaseId: null,
					processingLeaseExpiresAt: null,
					retryCount: 0,
					lastRetryAt: null,
					lastError: null,
					updatedAt: now
				})
				.where(and(eq(secrets.id, event.params.id), eq(secrets.userId, userId)));
			await tx.insert(checkinHistory).values({
				secretId: event.params.id,
				userId,
				checkedInAt: now,
				nextCheckIn
			});

			return {
				kind: 'success' as const,
				newRecord,
				nextCheckIn,
				checkInDays: lockedSecret.checkInDays
			};
		});

		if (transition.kind === 'not_found') {
			return json({ error: 'Secret not found' }, { status: 404 });
		}
		if (transition.kind === 'already_disclosed') {
			return json({ error: 'Secret disclosure is already complete' }, { status: 409 });
		}
		if (transition.kind === 'disclosure_in_progress') {
			return json({ error: 'Secret disclosure is already in progress' }, { status: 409 });
		}

		const warnings: string[] = [];
		try {
			await logCheckIn(
				userId,
				event.params.id,
				{
					nextCheckIn: transition.nextCheckIn.toISOString(),
					checkInDays: transition.checkInDays,
					bitcoinGeneration: transition.newRecord.generation
				},
				event
			);
		} catch {
			warnings.push('audit_reconciliation_required');
		}
		try {
			await scheduleRemindersForSecret(
				event.params.id,
				transition.nextCheckIn,
				transition.checkInDays
			);
		} catch {
			warnings.push('reminder_reconciliation_required');
		}

		return json({
			utxoId: transition.newRecord.id,
			newTxId: transition.newRecord.txId,
			generation: transition.newRecord.generation,
			previousUtxoId: current.id,
			nextCheckIn: transition.nextCheckIn.toISOString(),
			...(warnings.length > 0 ? { warnings } : {})
		});
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Invalid Bitcoin refresh' },
			{ status: 400 }
		);
	}
};
