import { and, eq, sql } from 'drizzle-orm';
import { disclosureLog, secrets } from '$lib/db/schema';
import type { getDatabase } from '$lib/db/get-database';

type Database = Awaited<ReturnType<typeof getDatabase>>;

export interface DisclosureRecipientClaim extends Record<string, unknown> {
	id: string;
	status: string;
}

export class StaleDisclosureLeaseError extends Error {
	constructor() {
		super('Disclosure lease is stale or expired');
		this.name = 'StaleDisclosureLeaseError';
	}
}

/**
 * Claim one recipient idempotently while the parent disclosure lease is still
 * current. The row lock serializes this check with parent-lease takeover, and
 * the deterministic dedupe key lets legacy nullable rows remain as audit data.
 */
export async function claimDisclosureRecipient(
	db: Database,
	params: {
		secretId: string;
		recipientEmail: string;
		recipientName: string | null;
		leaseId: string;
	}
): Promise<DisclosureRecipientClaim> {
	const recipientEmail = params.recipientEmail.trim().toLowerCase();
	const dedupeKey = `${params.secretId}:${recipientEmail}`;
	const [entry] = await db.execute<DisclosureRecipientClaim>(sql`
		WITH live_lease AS MATERIALIZED (
			SELECT ${secrets.id}
			FROM ${secrets}
			WHERE ${secrets.id} = ${params.secretId}::uuid
				AND ${secrets.processingLeaseId} = ${params.leaseId}::uuid
				AND ${secrets.processingLeaseExpiresAt} > CURRENT_TIMESTAMP
			FOR UPDATE
		)
		INSERT INTO ${disclosureLog} (
			"secret_id", "recipient_email", "recipient_name", "status", "lease_id", "dedupe_key"
		)
		SELECT
			${params.secretId}::uuid,
			${recipientEmail},
			${params.recipientName},
			'pending'::disclosure_status,
			${params.leaseId}::uuid,
			${dedupeKey}
		FROM live_lease
		ON CONFLICT ("dedupe_key") DO UPDATE SET
			"recipient_name" = EXCLUDED."recipient_name",
			"status" = CASE
				WHEN ${disclosureLog.status} = 'sent' THEN ${disclosureLog.status}
				ELSE 'pending'::disclosure_status
			END,
			"error" = CASE
				WHEN ${disclosureLog.status} = 'sent' THEN ${disclosureLog.error}
				ELSE NULL
			END,
			"retry_count" = CASE
				WHEN ${disclosureLog.status} = 'sent' THEN ${disclosureLog.retryCount}
				ELSE ${disclosureLog.retryCount} + 1
			END,
			"lease_id" = CASE
				WHEN ${disclosureLog.status} = 'sent' THEN NULL
				ELSE EXCLUDED."lease_id"
			END,
			"updated_at" = CURRENT_TIMESTAMP
		WHERE EXISTS (SELECT 1 FROM live_lease)
		RETURNING ${disclosureLog.id}, ${disclosureLog.status}
	`);

	if (!entry) {
		throw new StaleDisclosureLeaseError();
	}
	return entry;
}

/**
 * Persist a recipient outcome only while this worker still owns the disclosure
 * lease. A stale worker may have completed a provider request, but it cannot
 * overwrite the state owned by a replacement worker.
 */
export async function updateDisclosureLog(
	db: Database,
	secretId: string,
	logId: string,
	leaseId: string,
	status: 'sent' | 'failed',
	error?: string
): Promise<boolean> {
	try {
		const now = new Date();
		const [updated] = await db
			.update(disclosureLog)
			.set({
				status,
				leaseId: null,
				sentAt: status === 'sent' ? now : null,
				error: error ?? null,
				updatedAt: now
			})
			.where(
				and(
					eq(disclosureLog.id, logId),
					eq(disclosureLog.leaseId, leaseId),
					sql`exists (
						select 1 from ${secrets}
						where ${secrets.id} = ${secretId}::uuid
							and ${secrets.processingLeaseId} = ${leaseId}::uuid
							and ${secrets.processingLeaseExpiresAt} > CURRENT_TIMESTAMP
					)`
				)
			)
			.returning({ id: disclosureLog.id });

		return Boolean(updated);
	} catch (error) {
		console.error(`Failed to update disclosure log ${logId}:`, error);
		return false;
	}
}

export function shouldRetrySecret(retryCount: number): boolean {
	const MAX_RETRIES = 5;
	return retryCount < MAX_RETRIES;
}
