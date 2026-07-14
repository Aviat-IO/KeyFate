import { describe, expect, it } from 'vitest';
import { parseDatabaseConnection } from '$lib/db/connection-policy';

describe('PostgreSQL transport policy', () => {
	it('requires verified TLS for production TCP connections', () => {
		expect(() =>
			parseDatabaseConnection('postgresql://user:pass@db.example/keyfate', {
				NODE_ENV: 'production'
			})
		).toThrow('sslmode=verify-full');

		const parsed = parseDatabaseConnection(
			'postgresql://user:pass@db.example/keyfate?sslmode=verify-full',
			{ NODE_ENV: 'production' }
		);
		expect(parsed.transport).toBe('tcp');
		expect(parsed.options.ssl).toBe('verify-full');
	});

	it('rejects an explicit TLS bypass on TCP in every environment', () => {
		expect(() =>
			parseDatabaseConnection('postgresql://user:pass@localhost/keyfate?sslmode=disable', {
				NODE_ENV: 'development'
			})
		).toThrow('allowed only for validated Unix sockets');
	});

	it('allows ssl:false only for a validated Unix socket URL', () => {
		const parsed = parseDatabaseConnection(
			'postgresql://user:pass@localhost/keyfate?host=%2Fvar%2Frun%2Fpostgresql',
			{ NODE_ENV: 'production' }
		);
		expect(parsed.transport).toBe('unix');
		expect(parsed.options).toMatchObject({
			host: '/var/run/postgresql',
			database: 'keyfate',
			username: 'user',
			password: 'pass',
			ssl: false
		});
	});

	it('rejects ambiguous or malformed Unix socket URLs', () => {
		expect(() =>
			parseDatabaseConnection(
				'postgresql://user:pass@db.example/keyfate?host=%2Fvar%2Frun%2Fpostgresql',
				{ NODE_ENV: 'production' }
			)
		).toThrow('must use localhost');
		expect(() =>
			parseDatabaseConnection('postgresql://user:pass@localhost/keyfate?host=relative', {
				NODE_ENV: 'production'
			})
		).toThrow('host query parameter must be an absolute Unix socket directory');
	});

	it('strictly rejects malformed and non-PostgreSQL URLs', () => {
		expect(() => parseDatabaseConnection('not-a-url')).toThrow('valid PostgreSQL URL');
		expect(() => parseDatabaseConnection('https://db.example/keyfate')).toThrow(
			'must use postgresql:// or postgres://'
		);
		expect(() => parseDatabaseConnection('postgresql://db.example')).toThrow(
			'include a username and database name'
		);
	});
});
