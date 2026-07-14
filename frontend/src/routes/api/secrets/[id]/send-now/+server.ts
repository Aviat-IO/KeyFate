import { randomUUID } from 'node:crypto';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireCSRFProtection, createCSRFErrorResponse } from '$lib/csrf';
import { getDatabase } from '$lib/db/drizzle';
import { bitcoinUtxos, secrets, users } from '$lib/db/schema';
import type { SecretUpdate } from '$lib/db/schema';
import { getAllRecipients, hasBeenDisclosed } from '$lib/db/queries/secrets';
import { sendSecretDisclosureEmail } from '$lib/email/email-service';
import { logEmailFailure } from '$lib/email/email-failure-logger';
import { decryptMessage } from '$lib/encryption';
import {
	claimDisclosureRecipient,
	updateDisclosureLog,
	type DisclosureRecipientClaim
} from '$lib/cron/disclosure-helpers';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { logger } from '$lib/logger';

const PROCESSING_LEASE_MS = 15 * 60 * 1000;

export const POST: RequestHandler = async (event) => {
	try {
		const id = event.params.id;

		const csrfCheck = await requireCSRFProtection(event);
		if (!csrfCheck.valid) {
			return createCSRFErrorResponse();
		}

		const session = await event.locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const db = await getDatabase();

		// Fetch secret and verify ownership
		const [secret] = await db
			.select()
			.from(secrets)
			.where(and(eq(secrets.id, id), eq(secrets.userId, session.user.id)));

		if (!secret) {
			return json({ error: 'Secret not found' }, { status: 404 });
		}

		if (secret.status !== 'failed') {
			return json({ error: 'Only failed secrets can be sent immediately' }, { status: 400 });
		}

		// Check that no disclosures have been sent
		if (await hasBeenDisclosed(id)) {
			return json(
				{ error: 'This secret has already been disclosed to recipients' },
				{ status: 400 }
			);
		}

		// Fetch the user record for sender name
		const [user] = await db.select().from(users).where(eq(users.id, session.user.id));

		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		// Set status to triggered with the same fenced lease used by cron workers.
		const leaseId = randomUUID();
		const processingStartedAt = new Date();
		const [locked] = await db
			.update(secrets)
			.set({
				status: 'triggered',
				processingStartedAt,
				processingLeaseId: leaseId,
				processingLeaseExpiresAt: new Date(processingStartedAt.getTime() + PROCESSING_LEASE_MS),
				updatedAt: processingStartedAt
			} as SecretUpdate)
			.where(and(eq(secrets.id, id), eq(secrets.status, 'failed')))
			.returning({ id: secrets.id });

		if (!locked) {
			return json({ error: 'Secret status changed concurrently' }, { status: 409 });
		}

		// Fetch recipients
		const recipients = await getAllRecipients(id);
		if (recipients.length === 0) {
			await db
				.update(secrets)
				.set({
					status: 'failed',
					processingStartedAt: null,
					processingLeaseId: null,
					processingLeaseExpiresAt: null,
					lastError: 'No recipients configured',
					updatedAt: new Date()
				} as SecretUpdate)
				.where(and(eq(secrets.id, id), eq(secrets.processingLeaseId, leaseId)));

			return json({ error: 'No recipients configured' }, { status: 400 });
		}

		let bitcoinRecovery:
			| {
					encryptedRecoveryTx: string | null;
					recoverySenderPubkey: string | null;
					recoveryManifest: unknown;
					generation: number;
			  }
			| undefined;
		try {
			[bitcoinRecovery] = await db
				.select({
					encryptedRecoveryTx: bitcoinUtxos.encryptedRecoveryTx,
					recoverySenderPubkey: bitcoinUtxos.recoverySenderPubkey,
					recoveryManifest: bitcoinUtxos.recoveryManifest,
					generation: bitcoinUtxos.generation
				})
				.from(bitcoinUtxos)
				.where(
					and(eq(bitcoinUtxos.secretId, id), inArray(bitcoinUtxos.status, ['pending', 'confirmed']))
				)
				.orderBy(desc(bitcoinUtxos.generation))
				.limit(1);
		} catch {
			// Bitcoin recovery is optional and must not block the server-share disclosure.
		}
		const bitcoinRecipientId =
			bitcoinRecovery?.recoveryManifest &&
			typeof bitcoinRecovery.recoveryManifest === 'object' &&
			'recipientId' in bitcoinRecovery.recoveryManifest &&
			typeof bitcoinRecovery.recoveryManifest.recipientId === 'string'
				? bitcoinRecovery.recoveryManifest.recipientId
				: null;

		// Decrypt the server share
		let decryptedContent: string;
		try {
			const ivBuffer = Buffer.from(secret.iv || '', 'base64');
			const authTagBuffer = Buffer.from(secret.authTag || '', 'base64');
			decryptedContent = await decryptMessage(
				secret.serverShare || '',
				ivBuffer,
				authTagBuffer,
				secret.keyVersion || 1
			);
		} catch {
			await db
				.update(secrets)
				.set({
					status: 'failed',
					processingStartedAt: null,
					processingLeaseId: null,
					processingLeaseExpiresAt: null,
					lastError: 'Decryption failed',
					updatedAt: new Date()
				} as SecretUpdate)
				.where(and(eq(secrets.id, id), eq(secrets.processingLeaseId, leaseId)));

			return json({ error: 'Failed to decrypt secret' }, { status: 500 });
		}

		// Send disclosure emails
		let sent = 0;
		let failed = 0;

		for (const recipient of recipients) {
			const contactEmail = recipient.email || '';
			if (!contactEmail) continue;

			let logEntry: DisclosureRecipientClaim;
			try {
				logEntry = await claimDisclosureRecipient(db, {
					secretId: id,
					recipientEmail: contactEmail,
					recipientName: recipient.name,
					leaseId
				});

				if (logEntry.status === 'sent') {
					sent++;
					continue;
				}
			} catch (error) {
				logger.error('Failed to claim disclosure log', error instanceof Error ? error : undefined, {
					secretId: id,
					recipient: contactEmail
				});
				failed++;
				continue;
			}

			try {
				const emailResult = await sendSecretDisclosureEmail({
					contactEmail,
					contactName: recipient.name,
					secretTitle: secret.title,
					senderName: user.name || user.email,
					message: 'This secret was sent immediately by the owner after a failed delivery attempt.',
					secretContent: decryptedContent,
					disclosureReason: 'manual',
					senderLastSeen: secret.lastCheckIn || undefined,
					secretCreatedAt: secret.createdAt || undefined,
					nostrManifest:
						recipient.nostrSchemeVersion === 2 && recipient.nostrManifestEvent
							? JSON.stringify(recipient.nostrManifestEvent)
							: undefined,
					bitcoinRecoveryEnvelope:
						bitcoinRecipientId === recipient.id && bitcoinRecovery?.encryptedRecoveryTx
							? bitcoinRecovery.encryptedRecoveryTx
							: undefined,
					bitcoinRecoverySenderPubkey:
						bitcoinRecipientId === recipient.id && bitcoinRecovery?.recoverySenderPubkey
							? bitcoinRecovery.recoverySenderPubkey
							: undefined,
					bitcoinRecoveryGeneration:
						bitcoinRecipientId === recipient.id ? bitcoinRecovery?.generation : undefined
				});

				if (emailResult.success) {
					if (await updateDisclosureLog(db, id, logEntry.id, leaseId, 'sent')) sent++;
					else failed++;
					logger.info('Send-now disclosure email sent', {
						secretId: id,
						recipient: contactEmail,
						messageId: emailResult.messageId
					});
				} else {
					await updateDisclosureLog(
						db,
						id,
						logEntry.id,
						leaseId,
						'failed',
						emailResult.error || 'Unknown error'
					);
					await logEmailFailure({
						emailType: 'disclosure',
						provider: (emailResult.provider || 'sendgrid') as 'sendgrid' | 'console-dev' | 'resend',
						recipient: contactEmail,
						subject: `Secret Disclosure: ${secret.title}`,
						errorMessage: emailResult.error || 'Unknown error'
					});
					failed++;
					logger.error('Send-now disclosure email failed', undefined, {
						secretId: id,
						recipient: contactEmail,
						error: emailResult.error
					});
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : 'Unknown error';
				await updateDisclosureLog(db, id, logEntry.id, leaseId, 'failed', errorMsg);
				await logEmailFailure({
					emailType: 'disclosure',
					provider: 'sendgrid',
					recipient: contactEmail,
					subject: `Secret Disclosure: ${secret.title}`,
					errorMessage: errorMsg
				});
				failed++;
			}
		}

		// Securely clear decrypted content
		decryptedContent = '';

		const allSent = sent === recipients.length && failed === 0;

		const leaseIsStillValid = and(
			eq(secrets.id, id),
			eq(secrets.processingLeaseId, leaseId),
			sql`${secrets.processingLeaseExpiresAt} > now()`
		);
		if (allSent) {
			const finalized = await db
				.update(secrets)
				.set({
					status: 'triggered',
					triggeredAt: new Date(),
					processingStartedAt: null,
					processingLeaseId: null,
					processingLeaseExpiresAt: null,
					lastError: null,
					updatedAt: new Date()
				} as SecretUpdate)
				.where(leaseIsStillValid)
				.returning({ id: secrets.id });
			if (finalized.length !== 1) {
				return json(
					{
						error: 'Disclosure lease was lost after delivery; reconciliation required',
						sent,
						failed
					},
					{ status: 409 }
				);
			}

			return json({ success: true, sent, failed });
		} else {
			const finalized = await db
				.update(secrets)
				.set({
					status: 'failed',
					processingStartedAt: null,
					processingLeaseId: null,
					processingLeaseExpiresAt: null,
					lastError: `Send now: sent ${sent}, failed ${failed}`,
					updatedAt: new Date()
				} as SecretUpdate)
				.where(leaseIsStillValid)
				.returning({ id: secrets.id });
			if (finalized.length !== 1) {
				return json(
					{
						error: 'Disclosure lease was lost after delivery; reconciliation required',
						sent,
						failed
					},
					{ status: 409 }
				);
			}

			return json(
				{
					success: false,
					error: `Failed to send to ${failed} recipient(s)`,
					sent,
					failed
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		logger.error(
			'Error in POST /api/secrets/[id]/send-now',
			error instanceof Error ? error : undefined
		);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
