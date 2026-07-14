import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import {
	parseDatabaseConnection,
	type ParsedDatabaseConnection
} from '../src/lib/db/connection-policy';

const MIGRATION_LOCK_NAME = 'keyfate:migrations';

export function getMigrationDatabaseConnection(): ParsedDatabaseConnection {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error('DATABASE_URL is required for production migrations');
	}
	return parseDatabaseConnection(databaseUrl);
}

export function getMigrationDatabaseUrl(): string {
	return getMigrationDatabaseConnection().url;
}

export async function runMigrations(): Promise<void> {
	const parsed = getMigrationDatabaseConnection();
	const client = postgres(parsed.url, {
		...parsed.options,
		// One dedicated session holds the advisory lock while Drizzle uses the
		// second session for its own migration transaction.
		max: 2,
		prepare: false,
		connection: {
			...parsed.options.connection,
			application_name: 'keyfate-migration'
		}
	});
	const database = drizzle(client);
	const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
	let reserved: Awaited<ReturnType<typeof client.reserve>> | null = null;
	let locked = false;

	try {
		reserved = await client.reserve();
		await reserved.unsafe("SET lock_timeout = '30s'");
		await reserved`SELECT pg_advisory_lock(hashtext(${MIGRATION_LOCK_NAME}))`;
		locked = true;
		await migrate(database, { migrationsFolder });
	} finally {
		if (reserved) {
			try {
				if (locked) {
					await reserved`SELECT pg_advisory_unlock(hashtext(${MIGRATION_LOCK_NAME}))`;
				}
			} finally {
				reserved.release();
			}
		}
		await client.end({ timeout: 5 });
	}
}

if (import.meta.main) {
	try {
		await runMigrations();
		console.log('Database migrations completed.');
	} catch (error) {
		console.error('Database migration failed:', error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
