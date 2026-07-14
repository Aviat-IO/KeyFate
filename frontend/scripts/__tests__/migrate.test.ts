import { afterEach, describe, expect, it } from 'vitest';
import { getMigrationDatabaseConnection, getMigrationDatabaseUrl } from '../migrate';

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
	if (originalDatabaseUrl === undefined) {
		delete process.env.DATABASE_URL;
	} else {
		process.env.DATABASE_URL = originalDatabaseUrl;
	}
	if (originalNodeEnv === undefined) {
		delete process.env.NODE_ENV;
	} else {
		process.env.NODE_ENV = originalNodeEnv;
	}
});

describe('production migration entrypoint', () => {
	it('fails closed when DATABASE_URL is absent', () => {
		delete process.env.DATABASE_URL;
		expect(() => getMigrationDatabaseUrl()).toThrow(
			'DATABASE_URL is required for production migrations'
		);
	});

	it('requires verified TLS for production TCP connections', () => {
		process.env.NODE_ENV = 'production';
		process.env.DATABASE_URL = 'postgresql://user:password@example.invalid/keyfate';
		expect(() => getMigrationDatabaseConnection()).toThrow(
			'Production TCP DATABASE_URL must set sslmode=verify-full'
		);

		process.env.DATABASE_URL = 'postgresql://user:password@example.invalid/keyfate?sslmode=disable';
		expect(() => getMigrationDatabaseConnection()).toThrow(
			'sslmode=disable is allowed only for validated Unix sockets'
		);
	});

	it('preserves verified TLS connection options', () => {
		process.env.NODE_ENV = 'production';
		process.env.DATABASE_URL =
			'postgresql://user:password@example.invalid/keyfate?sslmode=verify-full';
		expect(getMigrationDatabaseConnection()).toMatchObject({
			url: process.env.DATABASE_URL,
			transport: 'tcp',
			options: { ssl: 'verify-full' }
		});
	});

	it('preserves validated Unix-socket connection options', () => {
		process.env.NODE_ENV = 'production';
		process.env.DATABASE_URL =
			'postgresql://user:password@localhost/keyfate?host=%2Fvar%2Frun%2Fpostgresql&sslmode=disable';
		expect(getMigrationDatabaseConnection()).toMatchObject({
			transport: 'unix',
			options: {
				host: '/var/run/postgresql',
				database: 'keyfate',
				username: 'user',
				ssl: false
			}
		});
	});
});
