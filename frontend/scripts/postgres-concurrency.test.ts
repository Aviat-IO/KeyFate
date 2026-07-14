import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import postgres, { type Sql } from 'postgres';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
let sql: Sql | null = null;

beforeAll(async () => {
	if (!testDatabaseUrl) return;
	process.env.DATABASE_URL = testDatabaseUrl;
	process.env.NODE_ENV = 'test';
	sql = postgres(testDatabaseUrl, { max: 10, prepare: false });
});

afterAll(async () => {
	if (!testDatabaseUrl) return;
	const { closeDatabaseConnection } = await import('$lib/db/get-database');
	await closeDatabaseConnection();
	await sql?.end({ timeout: 5 });
});

function database(): Sql {
	if (!sql) throw new Error('TEST_DATABASE_URL is required');
	return sql;
}

describe.skipIf(!testDatabaseUrl)('PostgreSQL concurrency and fencing', () => {
	it('makes one atomic rate-limit decision under concurrent requests and resets expired windows', async () => {
		const identifier = randomUUID();
		const { checkRateLimitDB } = await import('$lib/rate-limit-db');

		const results = await Promise.all(
			Array.from({ length: 20 }, () => checkRateLimitDB('registration', identifier, 5, 60_000))
		);

		expect(results.every((result) => result.available)).toBe(true);
		expect(results.filter((result) => result.success)).toHaveLength(5);
		const [row] = await database()<[{ count: number }]>`
			select count from rate_limits where key = ${`registration:${identifier}`}
		`;
		expect(row.count).toBe(20);

		await database()`
			update rate_limits
			set count = 99, expires_at = now() - interval '1 second'
			where key = ${`registration:${identifier}`}
		`;
		const reset = await checkRateLimitDB('registration', identifier, 5, 60_000);
		expect(reset).toMatchObject({ success: true, available: true, remaining: 4 });

		await database()`delete from rate_limits where key = ${`registration:${identifier}`}`;
	});

	it('allows one disclosure lease, supports expired takeover, and fences the stale worker', async () => {
		const userId = `pg-disclosure-${randomUUID()}`;
		const secretId = randomUUID();
		const logId = randomUUID();
		await database()`insert into users (id, email) values (${userId}, ${`${userId}@example.com`})`;
		await database()`
			insert into secrets (id, user_id, title, status, next_check_in)
			values (${secretId}, ${userId}, 'Concurrency fixture', 'active', now() - interval '1 day')
		`;

		const { getDatabase } = await import('$lib/db/get-database');
		const { claimDisclosureSecret } = await import('$lib/cron/disclosure-claim');
		const { claimDisclosureRecipient, updateDisclosureLog } =
			await import('$lib/cron/disclosure-helpers');
		const db = await getDatabase();
		const now = new Date();
		const claims = await Promise.all([
			claimDisclosureSecret(db, secretId, now),
			claimDisclosureSecret(db, secretId, now)
		]);
		const acquired = claims.filter((claim) => claim !== null);
		expect(acquired).toHaveLength(1);
		const originalLease = acquired[0]!.leaseId;
		expect(await claimDisclosureSecret(db, secretId, new Date())).toBeNull();

		await database()`
			update secrets
			set processing_lease_expires_at = now() - interval '1 second'
			where id = ${secretId}
		`;
		const takeover = await claimDisclosureSecret(db, secretId, new Date());
		expect(takeover).not.toBeNull();
		expect(takeover!.leaseId).not.toBe(originalLease);

		await database()`
			insert into disclosure_log (id, secret_id, recipient_email, status, lease_id, dedupe_key)
			values (${logId}, ${secretId}, 'recipient@example.com', 'pending', ${takeover!.leaseId}, ${`${secretId}:recipient@example.com`})
		`;
		let staleClaimRejected = false;
		try {
			await claimDisclosureRecipient(db, {
				secretId,
				recipientEmail: 'recipient@example.com',
				recipientName: 'Recipient',
				leaseId: originalLease
			});
		} catch {
			staleClaimRejected = true;
		}
		expect(staleClaimRejected).toBe(true);
		const [stillOwnedByTakeover] = await database()<[{ lease_id: string | null }]>`
			select lease_id from disclosure_log where id = ${logId}
		`;
		expect(stillOwnedByTakeover.lease_id).toBe(takeover!.leaseId);

		expect(await updateDisclosureLog(db, secretId, logId, originalLease, 'sent')).toBe(false);
		expect(await updateDisclosureLog(db, secretId, logId, takeover!.leaseId, 'sent')).toBe(true);
		const [log] = await database()<[{ status: string; lease_id: string | null }]>`
			select status, lease_id from disclosure_log where id = ${logId}
		`;
		expect(log).toEqual({ status: 'sent', lease_id: null });

		const terminalReclaim = await claimDisclosureRecipient(db, {
			secretId,
			recipientEmail: 'recipient@example.com',
			recipientName: 'Recipient',
			leaseId: takeover!.leaseId
		});
		expect(terminalReclaim).toEqual({ id: logId, status: 'sent' });
		const [terminalLog] = await database()<[{ lease_id: string | null }]>`
			select lease_id from disclosure_log where id = ${logId}
		`;
		expect(terminalLog.lease_id).toBeNull();

		const failedClaim = await claimDisclosureRecipient(db, {
			secretId,
			recipientEmail: 'retry@example.com',
			recipientName: null,
			leaseId: takeover!.leaseId
		});
		expect(
			await updateDisclosureLog(db, secretId, failedClaim.id, takeover!.leaseId, 'failed')
		).toBe(true);
		await database()`
			update secrets
			set processing_lease_expires_at = now() - interval '1 second'
			where id = ${secretId}
		`;
		const retryTakeover = await claimDisclosureSecret(db, secretId, new Date());
		expect(retryTakeover).not.toBeNull();
		let staleRetryRejected = false;
		try {
			await claimDisclosureRecipient(db, {
				secretId,
				recipientEmail: 'retry@example.com',
				recipientName: null,
				leaseId: takeover!.leaseId
			});
		} catch {
			staleRetryRejected = true;
		}
		expect(staleRetryRejected).toBe(true);
		const retryClaim = await claimDisclosureRecipient(db, {
			secretId,
			recipientEmail: 'retry@example.com',
			recipientName: null,
			leaseId: retryTakeover!.leaseId
		});
		expect(retryClaim.status).toBe('pending');
		const [retryLog] = await database()<[{ lease_id: string | null }]>`
			select lease_id from disclosure_log where id = ${failedClaim.id}
		`;
		expect(retryLog.lease_id).toBe(retryTakeover!.leaseId);

		await database()`delete from users where id = ${userId}`;
	});

	it('allows one export lease, supports expired takeover, and rejects stale completion', async () => {
		const userId = `pg-export-${randomUUID()}`;
		const jobId = randomUUID();
		await database()`insert into users (id, email) values (${userId}, ${`${userId}@example.com`})`;
		await database()`
			insert into data_export_jobs (id, user_id, status, expires_at)
			values (${jobId}, ${userId}, 'pending', now() + interval '1 day')
		`;

		const { getDatabase } = await import('$lib/db/get-database');
		const { claimExportJob, completeExportClaim } = await import('$lib/cron/process-exports');
		const { createExportArtifact } = await import('$lib/gdpr/export-artifact');
		const db = await getDatabase();
		const now = new Date();
		const claims = await Promise.all([
			claimExportJob(db, jobId, now),
			claimExportJob(db, jobId, now)
		]);
		const acquired = claims.filter((claim) => claim !== null);
		expect(acquired).toHaveLength(1);
		const originalLease = acquired[0]!.leaseId;
		expect(await claimExportJob(db, jobId, new Date())).toBeNull();

		await database()`
			update data_export_jobs
			set lease_expires_at = now() - interval '1 second'
			where id = ${jobId}
		`;
		const takeover = await claimExportJob(db, jobId, new Date());
		expect(takeover).not.toBeNull();
		const artifact = await createExportArtifact({ fixture: 'durable export' });
		expect(await completeExportClaim(db, jobId, originalLease, artifact)).toBe(false);
		expect(await completeExportClaim(db, jobId, takeover!.leaseId, artifact)).toBe(true);
		const [job] = await database()<
			[{ status: string; lease_id: string | null; artifact_sha256: string | null }]
		>`
			select status, lease_id, artifact_sha256 from data_export_jobs where id = ${jobId}
		`;
		expect(job).toEqual({
			status: 'completed',
			lease_id: null,
			artifact_sha256: artifact.sha256
		});

		await database()`delete from users where id = ${userId}`;
	});

	it('rejects expired OTPs, resets attempts on a fresh challenge, and consumes success once', async () => {
		const email = `pg-otp-${randomUUID()}@example.com`;
		const expiredCode = '10000001';
		const freshCode = '20000002';
		await database()`
			insert into account_lockouts (email, failed_attempts) values (${email}, 2)
		`;
		await database()`
			insert into verification_tokens (identifier, token, expires, purpose, attempt_count)
			values (${email}, ${expiredCode}, now() - interval '1 minute', 'authentication', 5)
		`;

		const { validateOTPToken } = await import('$lib/auth/otp');
		const expired = await validateOTPToken(email, expiredCode);
		expect(expired).toEqual({
			success: false,
			valid: false,
			error: 'Invalid or expired OTP code'
		});

		await database()`
			insert into verification_tokens (identifier, token, expires, purpose, attempt_count)
			values (${email}, ${freshCode}, now() + interval '5 minutes', 'authentication', 0)
		`;
		const first = await validateOTPToken(email, freshCode);
		const replay = await validateOTPToken(email, freshCode);
		expect(first).toEqual({ success: true, valid: true });
		expect(replay.valid).toBe(false);
		const [lockout] = await database()<[{ failed_attempts: number }]>`
			select failed_attempts from account_lockouts where email = ${email}
		`;
		expect(lockout.failed_attempts).toBe(2);

		await database()`delete from verification_tokens where identifier = ${email}`;
		await database()`delete from account_lockouts where email = ${email}`;
	});
});
