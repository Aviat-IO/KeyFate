import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { describe, expect, it } from 'vitest';
import * as schema from '$lib/db/schema';

const adminDatabaseUrl = process.env.TEST_DATABASE_URL;

interface Journal {
	version: string;
	dialect: string;
	entries: Array<{ idx: number; tag: string; [key: string]: unknown }>;
}

describe.skipIf(!adminDatabaseUrl)('migration compatibility', () => {
	it('upgrades an 0008 database, reconciles legacy rows, and accepts mixed-version writes', async () => {
		const source = fileURLToPath(new URL('../drizzle', import.meta.url));
		const temporary = await mkdtemp(join(tmpdir(), 'keyfate-migrations-'));
		const databaseName = `keyfate_compat_${process.pid}`;
		const admin = postgres(adminDatabaseUrl!, { max: 1, prepare: false });
		const targetUrl = new URL(adminDatabaseUrl!);
		targetUrl.pathname = `/${databaseName}`;
		let target: ReturnType<typeof postgres> | null = null;

		try {
			await admin.unsafe(`create database "${databaseName}"`);
			await mkdir(join(temporary, 'meta'));
			const journal = JSON.parse(
				await readFile(join(source, 'meta', '_journal.json'), 'utf8')
			) as Journal;
			const baselineJournal = {
				...journal,
				entries: journal.entries.filter((entry) => entry.idx <= 8)
			};
			await writeFile(
				join(temporary, 'meta', '_journal.json'),
				JSON.stringify(baselineJournal, null, 2)
			);
			for (const entry of baselineJournal.entries) {
				await copyFile(join(source, `${entry.tag}.sql`), join(temporary, `${entry.tag}.sql`));
			}

			target = postgres(targetUrl.toString(), { max: 1, prepare: false });
			const database = drizzle(target, { schema });
			await migrate(database, { migrationsFolder: temporary });

			const userId = 'legacy-user';
			const secretId = '550e8400-e29b-41d4-a716-446655440000';
			await target`insert into users (id, email) values (${userId}, 'legacy@example.com')`;
			await target`
				insert into secrets (id, user_id, title, status)
				values (${secretId}, ${userId}, 'Legacy secret', 'active')
			`;
			await target`
				insert into disclosure_log (secret_id, recipient_email, status)
				values
					(${secretId}, 'legacy-recipient@example.com', 'pending'),
					(${secretId}, 'legacy-recipient@example.com', 'failed')
			`;
			await target`
				insert into data_export_jobs (user_id, status, expires_at)
				values (${userId}, 'pending', now() + interval '1 day')
			`;
			await target`
				insert into check_in_tokens (secret_id, token, expires_at)
				values (${secretId}, 'legacy-token', now() + interval '5 minutes')
			`;
			await target`
				insert into bitcoin_utxos (
					secret_id, tx_id, output_index, amount_sats, timelock_script,
					owner_pubkey, recipient_pubkey, ttl_blocks, status
				) values (
					${secretId}, ${'11'.repeat(32)}, 0, 50000, '51',
					${`02${'22'.repeat(32)}`}, ${`03${'33'.repeat(32)}`}, 144, 'pending'
				)
			`;

			await migrate(database, { migrationsFolder: source });
			const [upgraded] = await target<
				[
					{
						token_version: number;
						generation: number;
						legacy_disclosure_rows: number;
						legacy_dedupe_keys_null: boolean;
						processing_lease_id: string | null;
					}
				]
			>`
				select
					(select token_version from check_in_tokens where token = 'legacy-token') as token_version,
					(select generation from bitcoin_utxos where tx_id = ${'11'.repeat(32)}) as generation,
					(select count(*)::int from disclosure_log where recipient_email = 'legacy-recipient@example.com') as legacy_disclosure_rows,
					(select bool_and(dedupe_key is null) from disclosure_log where recipient_email = 'legacy-recipient@example.com') as legacy_dedupe_keys_null,
					(select processing_lease_id from secrets where id = ${secretId}) as processing_lease_id
			`;
			expect(upgraded).toEqual({
				token_version: 1,
				generation: 1,
				legacy_disclosure_rows: 2,
				legacy_dedupe_keys_null: true,
				processing_lease_id: null
			});

			const leaseId = randomUUID();
			await target`
				update secrets
				set status = 'triggered',
					processing_lease_id = ${leaseId},
					processing_lease_expires_at = now() + interval '5 minutes'
				where id = ${secretId}
			`;
			const { claimDisclosureRecipient } = await import('$lib/cron/disclosure-helpers');
			const firstClaim = await claimDisclosureRecipient(database, {
				secretId,
				recipientEmail: 'Legacy-Recipient@Example.com',
				recipientName: 'Legacy recipient',
				leaseId
			});
			const secondClaim = await claimDisclosureRecipient(database, {
				secretId,
				recipientEmail: 'legacy-recipient@example.com',
				recipientName: 'Legacy recipient',
				leaseId
			});
			expect(secondClaim.id).toBe(firstClaim.id);
			const [reconciled] = await target<[{ total_rows: number; deterministic_rows: number }]>`
				select
					count(*)::int as total_rows,
					count(*) filter (
						where dedupe_key = ${`${secretId}:legacy-recipient@example.com`}
					)::int as deterministic_rows
				from disclosure_log
				where secret_id = ${secretId}
					and lower(recipient_email) = 'legacy-recipient@example.com'
			`;
			expect(reconciled).toEqual({ total_rows: 3, deterministic_rows: 1 });

			// Simulate one old replica still writing rows without additive columns.
			await target`
				insert into disclosure_log (secret_id, recipient_email, status)
				values (${secretId}, 'mixed-version@example.com', 'pending')
			`;
			await target`
				insert into check_in_tokens (secret_id, token, expires_at)
				values (${secretId}, 'mixed-token', now() + interval '5 minutes')
			`;
			const [mixed] = await target<[{ token_version: number; dedupe_key: string | null }]>`
				select
					(select token_version from check_in_tokens where token = 'mixed-token') as token_version,
					(select dedupe_key from disclosure_log where recipient_email = 'mixed-version@example.com') as dedupe_key
			`;
			expect(mixed).toEqual({ token_version: 1, dedupe_key: null });
		} finally {
			await target?.end({ timeout: 5 });
			await admin.unsafe(`drop database if exists "${databaseName}" with (force)`);
			await admin.end({ timeout: 5 });
			await rm(temporary, { recursive: true, force: true });
		}
	}, 30_000);
});
