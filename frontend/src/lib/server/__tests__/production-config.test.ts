import { describe, expect, it } from 'vitest';
import { validateProductionConfig } from '$lib/server/production-config';

function validEnvironment(): NodeJS.ProcessEnv {
	return {
		NODE_ENV: 'production',
		DATABASE_URL: 'postgresql://keyfate:secret@db.internal:5432/keyfate?sslmode=verify-full',
		ORIGIN: 'https://keyfate.example',
		PUBLIC_SITE_URL: 'https://keyfate.example',
		AUTH_SECRET: 'a'.repeat(32),
		AUTH_GOOGLE_ID: 'client.apps.googleusercontent.com',
		AUTH_GOOGLE_SECRET: 'g'.repeat(24),
		EMAIL_PROVIDER: 'sendgrid',
		SENDGRID_API_KEY: 'SG.test',
		SENDGRID_SENDER_EMAIL: 'noreply@keyfate.example',
		TURNSTILE_SECRET_KEY: 'turnstile-secret',
		PUBLIC_TURNSTILE_SITE_KEY: 'turnstile-site',
		CRON_ENABLED: 'true',
		CRON_SECRET: 'c'.repeat(32),
		ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
		ENCRYPTION_KEY_VERSION: '1',
		OTP_PEPPER: 'o'.repeat(32),
		ACCOUNT_DELETION_PEPPER: 'd'.repeat(32),
		PAYMENT_PROVIDERS: 'stripe,btcpay',
		STRIPE_SECRET_KEY: 'sk_live_test',
		STRIPE_WEBHOOK_SECRET: 'whsec_test',
		STRIPE_PRICE_ID_PRO_MONTHLY: 'price_monthly',
		STRIPE_PRICE_ID_PRO_YEARLY: 'price_yearly',
		PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_test',
		BTCPAY_SERVER_URL: 'https://btcpay.example',
		BTCPAY_API_KEY: 'btcpay-api',
		BTCPAY_STORE_ID: 'store-id',
		BTCPAY_WEBHOOK_SECRET: 'btcpay-webhook',
		BITCOIN_ENROLLMENT_ENABLED: 'false',
		BITCOIN_NETWORK: 'signet',
		RAILWAY_ENVIRONMENT_NAME: 'production',
		NOSTR_PUBLISHING_ENABLED: 'true',
		NOSTR_RELAY_ALLOWLIST: 'wss://relay-1.example,wss://relay-2.example,wss://relay-3.example',
		APP_REVISION: 'a'.repeat(40)
	};
}

describe('production configuration contract', () => {
	it('accepts one complete canonical production configuration', () => {
		expect(validateProductionConfig(validEnvironment())).toEqual({ valid: true, errors: [] });
	});

	it('does not impose production requirements outside production', () => {
		expect(validateProductionConfig({ NODE_ENV: 'test' })).toEqual({ valid: true, errors: [] });
	});

	it.each([
		['DATABASE_URL', undefined],
		['AUTH_GOOGLE_ID', undefined],
		['SENDGRID_SENDER_EMAIL', undefined],
		['PUBLIC_TURNSTILE_SITE_KEY', undefined],
		['CRON_ENABLED', 'false'],
		['OTP_PEPPER', undefined],
		['APP_REVISION', 'not-a-sha']
	])('fails closed when %s is missing or malformed', (name, value) => {
		const environment = validEnvironment();
		if (value === undefined) delete environment[name];
		else environment[name] = value;
		expect(validateProductionConfig(environment).valid).toBe(false);
	});

	it('allows explicitly gated Signet enrollment in staging', () => {
		const environment = validEnvironment();
		environment.RAILWAY_ENVIRONMENT_NAME = 'staging';
		environment.BITCOIN_ENROLLMENT_ENABLED = 'true';

		expect(validateProductionConfig(environment)).toEqual({ valid: true, errors: [] });
	});

	it('rejects mock email, origin drift, insecure database transport, and production Bitcoin enablement', () => {
		const environment = validEnvironment();
		environment.EMAIL_PROVIDER = 'mock';
		environment.PUBLIC_SITE_URL = 'https://other.example';
		environment.DATABASE_URL = 'postgresql://keyfate:secret@db.internal/keyfate?sslmode=disable';
		environment.BITCOIN_ENROLLMENT_ENABLED = 'true';

		const result = validateProductionConfig(environment);
		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				'EMAIL_PROVIDER must be sendgrid in production',
				'ORIGIN and PUBLIC_SITE_URL must identify the same origin',
				'sslmode=disable is allowed only for validated Unix sockets',
				'BITCOIN_ENROLLMENT_ENABLED may be true only in staging until the funded signet gate passes'
			])
		);
	});

	it('rejects conflicting legacy Google variable aliases', () => {
		const environment = validEnvironment();
		environment.GOOGLE_CLIENT_ID = 'other.apps.googleusercontent.com';
		expect(validateProductionConfig(environment).errors).toContain(
			'GOOGLE_CLIENT_ID conflicts with canonical AUTH_GOOGLE_ID'
		);
	});
});
