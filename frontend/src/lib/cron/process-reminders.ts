/**
 * Core logic for the process-reminders cron job.
 *
 * Finds overdue secrets and sends disclosure emails to recipients.
 * Extracted from the route handler so the scheduler can call it directly
 * without self-invoking via HTTP loopback.
 */

import { logger } from '$lib/logger';
import { getDatabase } from '$lib/db/get-database';
import { getAllRecipients } from '$lib/db/queries/secrets';
import { bitcoinUtxos, secrets, users, disclosureLog } from '$lib/db/schema';
import type { Secret, SecretUpdate, User } from '$lib/db/schema';
import { sendAdminNotification } from '$lib/email/admin-notification-service';
import { logEmailFailure } from '$lib/email/email-failure-logger';
import { calculateBackoffDelay } from '$lib/email/email-retry-service';
import { sendSecretDisclosureEmail } from '$lib/email/email-service';
import { decryptMessage } from '$lib/encryption';
import { and, desc, eq, lt, inArray, isNull, or, sql } from 'drizzle-orm';
import { sanitizeError, CRON_CONFIG, isApproachingTimeout, logCronMetrics } from '$lib/cron/utils';
import {
	claimDisclosureRecipient,
	updateDisclosureLog,
	shouldRetrySecret
} from '$lib/cron/disclosure-helpers';
import { claimDisclosureSecret } from '$lib/cron/disclosure-claim';

export interface ProcessRemindersResult {
	processed: number;
	succeeded: number;
	failed: number;
	totalSent: number;
	totalFailed: number;
	totalSecrets: number;
	duration: number;
	timestamp: string;
}

async function withRetry<T>(
	operation: () => Promise<T>,
	maxRetries: number = 3,
	baseDelay: number = 1000
): Promise<T> {
	let lastError: Error;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error as Error;

			if (attempt === maxRetries) {
				throw lastError;
			}

			const delay = calculateBackoffDelay(attempt, baseDelay);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw lastError!;
}

async function processOverdueSecret(
	secret: Secret,
	user: User,
	startTimeMs: number
): Promise<{
	success: boolean;
	sent: number;
	failed: number;
	alreadyProcessing?: boolean;
}> {
	const db = await getDatabase();
	let leaseId: string | null = null;

	try {
		logger.info('Processing overdue secret', {
			secretId: secret.id,
			secretTitle: secret.title,
			retryCount: secret.retryCount,
			nextCheckIn: secret.nextCheckIn?.toISOString(),
			lastRetryAt: secret.lastRetryAt?.toISOString(),
			lastError: secret.lastError
		});

		const claim = await claimDisclosureSecret(db, secret.id);

		if (!claim) {
			logger.info('Secret already being processed by another worker', {
				secretId: secret.id
			});
			return { success: false, sent: 0, failed: 0, alreadyProcessing: true };
		}

		secret = claim.secret;
		leaseId = claim.leaseId;
		logger.info('Acquired disclosure lease for secret', {
			secretId: secret.id,
			leaseId,
			leaseExpiresAt: secret.processingLeaseExpiresAt?.toISOString()
		});

		if (!shouldRetrySecret(secret.retryCount)) {
			logger.warn('Secret exhausted all retries, marking as failed', {
				secretId: secret.id,
				secretTitle: secret.title,
				retryCount: secret.retryCount,
				maxRetries: CRON_CONFIG.MAX_SECRET_RETRIES,
				lastError: secret.lastError
			});

			await db
				.update(secrets)
				.set({
					status: 'failed',
					processingStartedAt: null,
					processingLeaseId: null,
					processingLeaseExpiresAt: null,
					lastError: `Max retries (${CRON_CONFIG.MAX_SECRET_RETRIES}) exceeded`,
					updatedAt: new Date()
				} as SecretUpdate)
				.where(and(eq(secrets.id, secret.id), eq(secrets.processingLeaseId, leaseId)));

			return { success: false, sent: 0, failed: 0 };
		}

		const recipients = await getAllRecipients(secret.id);

		if (recipients.length === 0) {
			logger.warn('No recipients configured for secret', {
				secretId: secret.id,
				secretTitle: secret.title,
				retryCount: secret.retryCount + 1
			});

			await db
				.update(secrets)
				.set({
					status: 'active',
					processingStartedAt: null,
					processingLeaseId: null,
					processingLeaseExpiresAt: null,
					lastError: 'No recipients configured',
					retryCount: secret.retryCount + 1,
					lastRetryAt: new Date(),
					updatedAt: new Date()
				} as SecretUpdate)
				.where(and(eq(secrets.id, secret.id), eq(secrets.processingLeaseId, leaseId)));

			return { success: false, sent: 0, failed: 0 };
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
					and(
						eq(bitcoinUtxos.secretId, secret.id),
						inArray(bitcoinUtxos.status, ['pending', 'confirmed'])
					)
				)
				.orderBy(desc(bitcoinUtxos.generation))
				.limit(1);
		} catch (error) {
			logger.warn('Bitcoin recovery metadata unavailable for disclosure', {
				secretId: secret.id,
				error: sanitizeError(error)
			});
		}
		const bitcoinRecipientId =
			bitcoinRecovery?.recoveryManifest &&
			typeof bitcoinRecovery.recoveryManifest === 'object' &&
			'recipientId' in bitcoinRecovery.recoveryManifest &&
			typeof bitcoinRecovery.recoveryManifest.recipientId === 'string'
				? bitcoinRecovery.recoveryManifest.recipientId
				: null;

		logger.info('Found recipients for disclosure', {
			secretId: secret.id,
			recipientCount: recipients.length,
			recipientEmails: recipients.map((r) => r.email).filter(Boolean)
		});

		// Use Buffer for secure memory handling of decrypted content
		let decryptedBuffer: Buffer | null = null;

		try {
			const ivBuffer = Buffer.from(secret.iv || '', 'base64');
			const authTagBuffer = Buffer.from(secret.authTag || '', 'base64');
			const decryptedContent = await decryptMessage(
				secret.serverShare || '',
				ivBuffer,
				authTagBuffer,
				secret.keyVersion || 1
			);

			// Store in Buffer instead of string for secure cleanup
			decryptedBuffer = Buffer.from(decryptedContent, 'utf8');
			logger.info('Successfully decrypted server share', {
				secretId: secret.id,
				keyVersion: secret.keyVersion
			});
		} catch (decryptError) {
			logger.error(
				'Decryption failed for secret',
				decryptError instanceof Error ? decryptError : undefined,
				{
					secretId: secret.id,
					secretTitle: secret.title,
					keyVersion: secret.keyVersion,
					hasServerShare: !!secret.serverShare,
					hasIv: !!secret.iv,
					hasAuthTag: !!secret.authTag,
					retryCount: secret.retryCount + 1
				}
			);

			await db
				.update(secrets)
				.set({
					status: 'active',
					processingStartedAt: null,
					processingLeaseId: null,
					processingLeaseExpiresAt: null,
					lastError: 'Decryption failed',
					retryCount: secret.retryCount + 1,
					lastRetryAt: new Date(),
					updatedAt: new Date()
				} as SecretUpdate)
				.where(and(eq(secrets.id, secret.id), eq(secrets.processingLeaseId, leaseId)));

			return { success: false, sent: 0, failed: 0 };
		}

		const recipientsByEmail = new Map<string, (typeof recipients)[number]>();
		for (const recipient of recipients) {
			if (recipient.email && !recipientsByEmail.has(recipient.email)) {
				recipientsByEmail.set(recipient.email, recipient);
			}
		}
		const deliveryRecipients = Array.from(recipientsByEmail.values());
		const undeliverableCount = recipients.filter((recipient) => !recipient.email).length;
		const recipientEmails = Array.from(recipientsByEmail.keys());

		const existingLogs =
			recipientEmails.length > 0
				? await db
						.select()
						.from(disclosureLog)
						.where(
							and(
								eq(disclosureLog.secretId, secret.id),
								inArray(disclosureLog.recipientEmail, recipientEmails),
								eq(disclosureLog.status, 'sent')
							)
						)
				: [];

		const sentEmails = new Set(existingLogs.map((log) => log.recipientEmail));

		if (sentEmails.size > 0) {
			logger.info('Found previously sent disclosures', {
				secretId: secret.id,
				alreadySent: Array.from(sentEmails)
			});
		}

		let sent = sentEmails.size;
		let failed = 0;
		let timedOut = false;

		try {
			for (const recipient of deliveryRecipients) {
				if (isApproachingTimeout(startTimeMs)) {
					logger.warn('Approaching timeout, stopping email processing', {
						secretId: secret.id,
						elapsedMs: Date.now() - startTimeMs,
						sent,
						remaining: deliveryRecipients.length - sent - failed
					});
					timedOut = true;
					break;
				}

				const contactEmail = recipient.email || '';
				if (!contactEmail) {
					logger.warn('Recipient has no email, skipping', {
						secretId: secret.id,
						recipientName: recipient.name
					});
					continue;
				}

				if (sentEmails.has(contactEmail)) {
					logger.info('Skipping already-sent recipient', {
						secretId: secret.id,
						recipient: contactEmail
					});
					continue;
				}

				const logEntry = await claimDisclosureRecipient(db, {
					secretId: secret.id,
					recipientEmail: contactEmail,
					recipientName: recipient.name,
					leaseId
				});

				if (logEntry.status === 'sent') {
					sentEmails.add(contactEmail);
					sent++;
					continue;
				}

				logger.info('Sending disclosure email', {
					secretId: secret.id,
					secretTitle: secret.title,
					recipient: contactEmail,
					recipientName: recipient.name,
					attempt: secret.retryCount + 1,
					maxRetries: CRON_CONFIG.MAX_RETRIES
				});

				const emailStartTime = Date.now();

				try {
					const emailResult = await withRetry(
						async () => {
							return await sendSecretDisclosureEmail({
								contactEmail,
								contactName: recipient.name,
								secretTitle: secret.title,
								senderName: user.name || user.email,
								message: `This secret was scheduled for disclosure because the check-in deadline was missed.`,
								secretContent: decryptedBuffer!.toString('utf8'),
								disclosureReason: 'scheduled',
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
						},
						CRON_CONFIG.MAX_RETRIES,
						1000
					);

					const emailDuration = Date.now() - emailStartTime;

					if (emailResult.success) {
						logger.info('Disclosure email sent successfully', {
							secretId: secret.id,
							recipient: contactEmail,
							messageId: emailResult.messageId,
							provider: emailResult.provider,
							durationMs: emailDuration
						});

						if (await updateDisclosureLog(db, logEntry.id, leaseId, 'sent')) {
							sentEmails.add(contactEmail);
							sent++;
						} else {
							failed++;
						}
					} else {
						logger.error('Disclosure email failed', undefined, {
							secretId: secret.id,
							secretTitle: secret.title,
							recipient: contactEmail,
							error: emailResult.error,
							provider: emailResult.provider,
							retryable: emailResult.retryable,
							retryAfter: emailResult.retryAfter,
							durationMs: emailDuration,
							secretRetryCount: secret.retryCount
						});

						await updateDisclosureLog(
							db,
							logEntry.id,
							leaseId,
							'failed',
							emailResult.error || 'Unknown error'
						);

						await logEmailFailure({
							emailType: 'disclosure',
							provider: (emailResult.provider || 'sendgrid') as
								| 'sendgrid'
								| 'console-dev'
								| 'resend',
							recipient: contactEmail,
							subject: `Secret Disclosure: ${secret.title}`,
							errorMessage: emailResult.error || 'Unknown error'
						});

						await sendAdminNotification({
							emailType: 'disclosure',
							recipient: contactEmail,
							errorMessage: emailResult.error || 'Unknown error',
							secretTitle: secret.title,
							timestamp: new Date()
						});

						failed++;
					}
				} catch (error) {
					const emailDuration = Date.now() - emailStartTime;
					const errorMsg = sanitizeError(error, secret.id);

					logger.error(
						'Disclosure email threw exception',
						error instanceof Error ? error : undefined,
						{
							secretId: secret.id,
							secretTitle: secret.title,
							recipient: contactEmail,
							errorMsg,
							durationMs: emailDuration,
							secretRetryCount: secret.retryCount
						}
					);

					await updateDisclosureLog(db, logEntry.id, leaseId, 'failed', errorMsg);

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
		} finally {
			// Securely zero out the buffer
			if (decryptedBuffer) {
				decryptedBuffer.fill(0);
				decryptedBuffer = null;
			}

			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}
		}

		if (timedOut) {
			logger.warn('Secret processing timed out, reverting to active for retry', {
				secretId: secret.id,
				sent,
				totalRecipients: recipients.length,
				retryCount: secret.retryCount + 1
			});

			await db
				.update(secrets)
				.set({
					status: 'active',
					processingStartedAt: null,
					processingLeaseId: null,
					processingLeaseExpiresAt: null,
					lastError: `Timeout after sending ${sent}/${recipients.length} emails`,
					retryCount: secret.retryCount + 1,
					lastRetryAt: new Date(),
					updatedAt: new Date()
				} as SecretUpdate)
				.where(and(eq(secrets.id, secret.id), eq(secrets.processingLeaseId, leaseId)));

			return { success: false, sent, failed };
		}

		const allSent = sent === deliveryRecipients.length && failed === 0 && undeliverableCount === 0;
		const finalStatus = allSent ? 'triggered' : 'active';

		logger.info('Secret disclosure processing complete', {
			secretId: secret.id,
			secretTitle: secret.title,
			finalStatus,
			sent,
			failed,
			totalRecipients: recipients.length,
			allSent,
			retryCount: allSent ? secret.retryCount : secret.retryCount + 1,
			durationMs: Date.now() - startTimeMs
		});

		await db
			.update(secrets)
			.set({
				status: finalStatus as 'triggered' | 'active',
				triggeredAt: allSent ? new Date() : null,
				processingStartedAt: null,
				processingLeaseId: null,
				processingLeaseExpiresAt: null,
				lastError: allSent ? null : `Sent: ${sent}, Failed: ${failed}`,
				retryCount: allSent ? secret.retryCount : secret.retryCount + 1,
				lastRetryAt: allSent ? null : new Date(),
				updatedAt: new Date()
			} as SecretUpdate)
			.where(and(eq(secrets.id, secret.id), eq(secrets.processingLeaseId, leaseId)));

		return { success: allSent, sent, failed };
	} catch (error) {
		const errorMsg = sanitizeError(error, secret.id);

		logger.error(
			'Unexpected error processing overdue secret',
			error instanceof Error ? error : undefined,
			{
				secretId: secret.id,
				secretTitle: secret.title,
				errorMsg,
				retryCount: secret.retryCount + 1,
				durationMs: Date.now() - startTimeMs
			}
		);

		try {
			if (leaseId) {
				await db
					.update(secrets)
					.set({
						status: 'active',
						processingStartedAt: null,
						processingLeaseId: null,
						processingLeaseExpiresAt: null,
						lastError: errorMsg,
						retryCount: secret.retryCount + 1,
						lastRetryAt: new Date(),
						updatedAt: new Date()
					} as SecretUpdate)
					.where(and(eq(secrets.id, secret.id), eq(secrets.processingLeaseId, leaseId)));
			}
		} catch {
			logger.error('Error rolling back secret status', undefined, {
				secretId: secret.id
			});
		}

		return { success: false, sent: 0, failed: 0 };
	}
}

export async function runProcessReminders(): Promise<ProcessRemindersResult> {
	const startTime = Date.now();
	const startDate = new Date();
	logger.info('process-reminders cron job started', {
		timestamp: startDate.toISOString()
	});

	const db = await getDatabase();

	const now = new Date();
	const nowIso = now.toISOString();

	// Fetch active overdue secrets and in-flight disclosures whose durable lease
	// expired after a worker crash. Backoff still applies to explicit retries.
	const overdueSecrets = await db
		.select({
			secret: secrets,
			user: users
		})
		.from(secrets)
		.innerJoin(users, eq(secrets.userId, users.id))
		.where(
			and(
				or(
					eq(secrets.status, 'active'),
					and(
						eq(secrets.status, 'triggered'),
						isNull(secrets.triggeredAt),
						or(isNull(secrets.processingLeaseExpiresAt), lt(secrets.processingLeaseExpiresAt, now))
					)
				),
				lt(secrets.nextCheckIn, now),
				sql`(
            ${secrets.lastRetryAt} IS NULL 
            OR ${secrets.retryCount} = 0
            OR ${secrets.lastRetryAt} < ${nowIso}::timestamp - (
              INTERVAL '1 minute' * ${CRON_CONFIG.RETRY_BACKOFF_BASE_MINUTES} * 
              POW(${CRON_CONFIG.RETRY_BACKOFF_EXPONENT}, ${secrets.retryCount})
            )
          )`
			)
		);

	logger.info('Found overdue secrets', {
		count: overdueSecrets.length,
		withBackoff: process.env.NODE_ENV === 'development'
	});

	// Observability: if no overdue secrets found, check if there are active
	// secrets with nextCheckIn approaching to detect silent failures
	if (overdueSecrets.length === 0) {
		try {
			const [activeStats] = await db
				.select({
					totalActive: sql<number>`count(*)`,
					nearDeadline: sql<number>`count(*) filter (where ${secrets.nextCheckIn} < ${nowIso}::timestamp + interval '1 hour')`,
					pastDeadlineTriggered: sql<number>`count(*) filter (where ${secrets.status} = 'triggered')`
				})
				.from(secrets)
				.where(eq(secrets.status, 'active'));

			const totalActive = Number(activeStats?.totalActive ?? 0);
			const nearDeadline = Number(activeStats?.nearDeadline ?? 0);

			if (totalActive > 0) {
				logger.info('Active secrets status check', {
					totalActive,
					nearDeadline,
					pastDeadlineTriggered: Number(activeStats?.pastDeadlineTriggered ?? 0)
				});
			}
		} catch (err) {
			// Don't let observability crash the cron
			logger.error('Error in observability check', undefined, {
				error: sanitizeError(err)
			});
		}
	}

	let processed = 0;
	let succeeded = 0;
	let failedCount = 0;
	let totalSent = 0;
	let totalFailed = 0;

	const queue = overdueSecrets.map((row) => ({
		secret: row.secret,
		user: row.user
	}));
	const active = new Set<Promise<void>>();
	let warnedAboutTime = false;

	while (queue.length > 0 || active.size > 0) {
		while (active.size < CRON_CONFIG.MAX_CONCURRENT_SECRETS && queue.length > 0) {
			const row = queue.shift()!;
			const { secret, user } = row;

			const promise = processOverdueSecret(secret, user, startTime)
				.then((result) => {
					if (!result.alreadyProcessing) {
						processed++;
						totalSent += result.sent;
						totalFailed += result.failed;

						if (result.success) {
							succeeded++;
						} else {
							failedCount++;
						}
					}
				})
				.catch((error) => {
					logger.error('Worker error for secret', undefined, {
						secretId: secret.id,
						error: sanitizeError(error)
					});
					processed++;
					failedCount++;
				})
				.finally(() => {
					active.delete(promise);
				});

			active.add(promise);
		}

		if (active.size > 0) {
			await Promise.race(active);
		}

		const elapsed = Date.now() - startTime;
		if (elapsed > CRON_CONFIG.CRON_INTERVAL_MS && !warnedAboutTime && queue.length > 0) {
			logger.warn('Processing exceeds cron interval', {
				elapsedMs: elapsed,
				cronIntervalMs: CRON_CONFIG.CRON_INTERVAL_MS,
				remaining: queue.length
			});
			warnedAboutTime = true;
		}
	}

	const duration = Date.now() - startTime;

	logCronMetrics('process-reminders', {
		duration,
		processed,
		succeeded,
		failed: failedCount
	});

	return {
		processed,
		succeeded,
		failed: failedCount,
		totalSent,
		totalFailed,
		totalSecrets: overdueSecrets.length,
		duration,
		timestamp: new Date().toISOString()
	};
}
