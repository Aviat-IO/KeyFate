import { afterEach, describe, expect, it } from 'vitest';
import { getMigrationDatabaseUrl } from '../migrate';

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
	if (originalDatabaseUrl === undefined) {
		delete process.env.DATABASE_URL;
	} else {
		process.env.DATABASE_URL = originalDatabaseUrl;
	}
});

describe('production migration entrypoint', () => {
	it('fails closed when DATABASE_URL is absent', () => {
		delete process.env.DATABASE_URL;
		expect(() => getMigrationDatabaseUrl()).toThrow(
			'DATABASE_URL is required for production migrations'
		);
	});

	it('uses the explicitly configured database URL', () => {
		process.env.DATABASE_URL = 'postgresql://example.invalid/keyfate';
		expect(getMigrationDatabaseUrl()).toBe('postgresql://example.invalid/keyfate');
	});
});
