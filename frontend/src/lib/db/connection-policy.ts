import { Buffer } from 'node:buffer';
import type { Options as PostgresOptions } from 'postgres';

export type PostgresConnectionOptions = Partial<PostgresOptions<Record<string, never>>>;

export interface ParsedDatabaseConnection {
	url: string;
	options: PostgresConnectionOptions;
	transport: 'tcp' | 'unix';
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
	if (value === undefined || value === '') return fallback;
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new Error(`${name} must be a positive integer`);
	}
	return parsed;
}

function parseVerifiedTlsOptions(
	environment: NodeJS.ProcessEnv
): NonNullable<PostgresConnectionOptions['ssl']> {
	const encodedCa = environment.DATABASE_CA_CERT_BASE64?.trim();
	const servername = environment.DATABASE_TLS_SERVER_NAME?.trim();

	if (!encodedCa && !servername) return 'verify-full';
	if (!encodedCa || !servername) {
		throw new Error(
			'DATABASE_CA_CERT_BASE64 and DATABASE_TLS_SERVER_NAME must be configured together'
		);
	}
	if (
		servername.length > 253 ||
		!/[a-z0-9]/i.test(servername) ||
		!/^[a-z0-9.-]+$/i.test(servername) ||
		servername.startsWith('.') ||
		servername.endsWith('.')
	) {
		throw new Error('DATABASE_TLS_SERVER_NAME must be a valid DNS name');
	}

	let ca: string;
	try {
		ca = Buffer.from(encodedCa, 'base64').toString('utf8').trim();
	} catch {
		throw new Error('DATABASE_CA_CERT_BASE64 must contain a base64-encoded PEM certificate');
	}
	if (!/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/.test(ca)) {
		throw new Error('DATABASE_CA_CERT_BASE64 must contain a base64-encoded PEM certificate');
	}

	return { ca, servername, rejectUnauthorized: true };
}

export function parseDatabaseConnection(
	connectionString: string,
	environment: NodeJS.ProcessEnv = process.env
): ParsedDatabaseConnection {
	let url: URL;
	try {
		url = new URL(connectionString);
	} catch {
		throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
	}

	if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
		throw new Error('DATABASE_URL must use postgresql:// or postgres://');
	}
	if (!url.username || !url.pathname || url.pathname === '/') {
		throw new Error('DATABASE_URL must include a username and database name');
	}

	const socketHost = url.searchParams.get('host');
	if (socketHost && !socketHost.startsWith('/')) {
		throw new Error('DATABASE_URL host query parameter must be an absolute Unix socket directory');
	}
	const isUnixSocket = socketHost?.startsWith('/') === true;
	const isProduction = environment.NODE_ENV === 'production';
	const sslMode = url.searchParams.get('sslmode');

	if (isUnixSocket) {
		// WHATWG URL parsing rejects the otherwise conventional hostless form
		// (`postgresql://user@/database`). Use localhost only as a syntactic
		// placeholder; the validated absolute `host` query parameter is the
		// actual postgres-js transport endpoint.
		if (url.hostname !== 'localhost') {
			throw new Error(
				'Unix-socket DATABASE_URL must use localhost as the URL hostname placeholder'
			);
		}
		if (socketHost === '/' || socketHost.includes('\0')) {
			throw new Error('Unix-socket DATABASE_URL must include a valid absolute socket directory');
		}
		return {
			url: connectionString,
			transport: 'unix',
			options: {
				host: socketHost!,
				database: decodeURIComponent(url.pathname.slice(1)),
				username: decodeURIComponent(url.username),
				password: decodeURIComponent(url.password),
				ssl: false,
				max: parsePositiveInteger(environment.DB_POOL_MAX, 5, 'DB_POOL_MAX'),
				idle_timeout: parsePositiveInteger(environment.DB_IDLE_TIMEOUT, 20, 'DB_IDLE_TIMEOUT'),
				connect_timeout: parsePositiveInteger(
					environment.DB_CONNECT_TIMEOUT,
					10,
					'DB_CONNECT_TIMEOUT'
				),
				max_lifetime: 5 * 60,
				prepare: false,
				connection: {
					application_name: 'keyfate-app',
					statement_timeout: parsePositiveInteger(
						environment.DB_STATEMENT_TIMEOUT,
						30_000,
						'DB_STATEMENT_TIMEOUT'
					)
				}
			}
		};
	}

	if (!url.hostname) {
		throw new Error('TCP DATABASE_URL must include a hostname');
	}
	if (sslMode === 'disable') {
		throw new Error('sslmode=disable is allowed only for validated Unix sockets');
	}
	if (isProduction && sslMode !== 'verify-full') {
		throw new Error('Production TCP DATABASE_URL must set sslmode=verify-full');
	}

	return {
		url: connectionString,
		transport: 'tcp',
		options: {
			ssl: isProduction ? parseVerifiedTlsOptions(environment) : undefined,
			max: parsePositiveInteger(environment.DB_POOL_MAX, 5, 'DB_POOL_MAX'),
			idle_timeout: parsePositiveInteger(environment.DB_IDLE_TIMEOUT, 20, 'DB_IDLE_TIMEOUT'),
			connect_timeout: parsePositiveInteger(
				environment.DB_CONNECT_TIMEOUT,
				10,
				'DB_CONNECT_TIMEOUT'
			),
			max_lifetime: 5 * 60,
			prepare: false,
			connection: {
				application_name: 'keyfate-app',
				statement_timeout: parsePositiveInteger(
					environment.DB_STATEMENT_TIMEOUT,
					30_000,
					'DB_STATEMENT_TIMEOUT'
				)
			}
		}
	};
}
