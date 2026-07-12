import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export function getMigrationDatabaseUrl(): string {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error('DATABASE_URL is required for production migrations');
	}
	return databaseUrl;
}

export async function runMigrations(): Promise<void> {
	const client = postgres(getMigrationDatabaseUrl(), {
		max: 1,
		prepare: false,
		connect_timeout: 15,
		idle_timeout: 5
	});
	const database = drizzle(client);
	const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

	try {
		await migrate(database, { migrationsFolder });
	} finally {
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
