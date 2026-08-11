/** Store public Bitcoin lifecycle metadata and a recipient-encrypted recovery transaction. */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDatabase } from '$lib/db/drizzle';
import { bitcoinUtxos, secretRecipients, secrets } from '$lib/db/schema';
import { requireCSRFProtection, createCSRFErrorResponse } from '$lib/csrf';
import { encryptedBitcoinEnvelopeSchema } from '$lib/bitcoin/recovery-envelope';
import { decodeCSVTimelockScript, MIN_UTXO_SATS } from '$lib/bitcoin/script';
import { scheduleRemindersForSecret } from '$lib/services/reminder-scheduler';
import { isBitcoinEnrollmentEnabled } from '$lib/server/bitcoin-enrollment';
import {
	bitcoinNetworkSchema,
	getBitcoinNetworkParams,
	type BitcoinNetwork
} from '$lib/bitcoin/network';

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const compressedPubkey = z.string().regex(/^(?:02|03)[0-9a-f]{64}$/);
const bodySchema = z
	.object({
		recipientId: z.string().uuid(),
		txId: hex64,
		outputIndex: z.number().int().nonnegative(),
		amountSats: z.number().int().min(MIN_UTXO_SATS),
		timelockScript: z.string().regex(/^(?:[0-9a-f]{2})+$/),
		ownerPubkey: compressedPubkey,
		branchPubkey: compressedPubkey,
		ttlBlocks: z.number().int().min(1).max(65535),
		recipientAddress: z.string().min(14).max(100),
		network: bitcoinNetworkSchema,
		generation: z.literal(1),
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
	if (!isBitcoinEnrollmentEnabled()) {
		return json({ error: 'Bitcoin enrollment is disabled' }, { status: 503 });
	}

	const parsed = bodySchema.safeParse(await event.request.json());
	if (!parsed.success) {
		return json(
			{ error: 'Only recipient-encrypted Bitcoin v2 artifacts are accepted' },
			{ status: 400 }
		);
	}

	try {
		const body = parsed.data;
		if (body.network !== 'signet') throw new Error('Bitcoin enrollment is restricted to Signet');
		validateAddress(body.recipientAddress, body.network);
		const decodedScript = decodeCSVTimelockScript(hex.decode(body.timelockScript));
		if (
			hex.encode(decodedScript.ownerPubkey) !== body.ownerPubkey ||
			hex.encode(decodedScript.recipientPubkey) !== body.branchPubkey ||
			decodedScript.ttlBlocks !== body.ttlBlocks
		) {
			throw new Error('Bitcoin timelock script does not match declared keys and delay');
		}
		if (body.encryptedRecoveryEnvelope.senderPubkey !== body.ownerPubkey.slice(2)) {
			throw new Error('Recovery envelope sender must match the owner continuity key');
		}

		const db = await getDatabase();
		const [secret] = await db
			.select({
				id: secrets.id,
				checkInDays: secrets.checkInDays,
				nostrDeliveryStatus: secrets.nostrDeliveryStatus,
				bitcoinDeliveryStatus: secrets.bitcoinDeliveryStatus
			})
			.from(secrets)
			.where(and(eq(secrets.id, event.params.id), eq(secrets.userId, session.user.id)));
		if (!secret) return json({ error: 'Secret not found' }, { status: 404 });
		if (secret.bitcoinDeliveryStatus !== 'pending') {
			return json({ error: 'Bitcoin enrollment is not pending' }, { status: 409 });
		}

		const [recipient] = await db
			.select({
				id: secretRecipients.id,
				nostrPubkey: secretRecipients.nostrPubkey,
				nostrCapsuleEventId: secretRecipients.nostrCapsuleEventId
			})
			.from(secretRecipients)
			.where(
				and(
					eq(secretRecipients.id, body.recipientId),
					eq(secretRecipients.secretId, event.params.id)
				)
			);
		if (
			!recipient?.nostrPubkey ||
			recipient.nostrPubkey !== body.encryptedRecoveryEnvelope.recipientNostrPubkey ||
			recipient.nostrCapsuleEventId !== body.nostrCapsuleEventId
		) {
			return json(
				{ error: 'Bitcoin recipient binding does not match Nostr v2 enrollment' },
				{ status: 400 }
			);
		}

		const activatedAt = new Date();
		const shouldActivate = secret.nostrDeliveryStatus === 'ready';
		const [record] = await db.transaction(async (tx) => {
			const inserted = await tx
				.insert(bitcoinUtxos)
				.values({
					secretId: event.params.id,
					txId: body.txId,
					outputIndex: body.outputIndex,
					amountSats: body.amountSats,
					timelockScript: body.timelockScript,
					ownerPubkey: body.ownerPubkey,
					recipientPubkey: body.branchPubkey,
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
						recipientId: body.recipientId,
						recipientNostrPubkey: recipient.nostrPubkey,
						nostrCapsuleEventId: body.nostrCapsuleEventId
					}
				})
				.returning();

			await tx
				.update(secrets)
				.set({
					bitcoinDeliveryStatus: 'ready',
					...(shouldActivate
						? {
								status: 'active' as const,
								lastCheckIn: activatedAt,
								nextCheckIn: new Date(
									activatedAt.getTime() + secret.checkInDays * 24 * 60 * 60 * 1000
								)
							}
						: {}),
					updatedAt: activatedAt
				})
				.where(eq(secrets.id, event.params.id));
			return inserted;
		});

		if (shouldActivate) {
			await scheduleRemindersForSecret(
				event.params.id,
				new Date(activatedAt.getTime() + secret.checkInDays * 24 * 60 * 60 * 1000),
				secret.checkInDays
			);
		}

		return json(
			{
				utxoId: record.id,
				txId: record.txId,
				generation: record.generation,
				active: shouldActivate
			},
			{ status: 201 }
		);
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Invalid Bitcoin artifact' },
			{ status: 400 }
		);
	}
};
