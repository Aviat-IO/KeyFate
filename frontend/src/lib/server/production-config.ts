import { parseDatabaseConnection } from '$lib/db/connection-policy';

export interface ProductionConfigValidation {
	valid: boolean;
	errors: string[];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const GOOGLE_CLIENT_ID_PATTERN = /^[^\s]+\.apps\.googleusercontent\.com$/;

function requireValue(
	environment: NodeJS.ProcessEnv,
	name: string,
	errors: string[]
): string | undefined {
	const value = environment[name]?.trim();
	if (!value) errors.push(`${name} is required`);
	return value;
}

function parseHttpsUrl(value: string | undefined, name: string, errors: string[]): URL | undefined {
	if (!value) return undefined;
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
			errors.push(`${name} must be an HTTPS origin without credentials or fragments`);
			return undefined;
		}
		return url;
	} catch {
		errors.push(`${name} must be a valid URL`);
		return undefined;
	}
}

function validateBase64Key(environment: NodeJS.ProcessEnv, name: string, errors: string[]): void {
	const value = requireValue(environment, name, errors);
	if (!value) return;
	try {
		if (Buffer.from(value, 'base64').length !== 32) {
			errors.push(`${name} must decode to exactly 32 bytes`);
		}
	} catch {
		errors.push(`${name} must be valid base64`);
	}
}

export function validateProductionConfig(
	environment: NodeJS.ProcessEnv = process.env
): ProductionConfigValidation {
	if (environment.NODE_ENV !== 'production') return { valid: true, errors: [] };

	const errors: string[] = [];
	const databaseUrl = requireValue(environment, 'DATABASE_URL', errors);
	if (databaseUrl) {
		try {
			parseDatabaseConnection(databaseUrl, environment);
		} catch (error) {
			errors.push(error instanceof Error ? error.message : 'DATABASE_URL is invalid');
		}
	}

	const origin = parseHttpsUrl(requireValue(environment, 'ORIGIN', errors), 'ORIGIN', errors);
	const publicSiteUrl = parseHttpsUrl(
		requireValue(environment, 'PUBLIC_SITE_URL', errors),
		'PUBLIC_SITE_URL',
		errors
	);
	if (origin && publicSiteUrl && origin.origin !== publicSiteUrl.origin) {
		errors.push('ORIGIN and PUBLIC_SITE_URL must identify the same origin');
	}

	const authSecret = requireValue(environment, 'AUTH_SECRET', errors);
	if (authSecret && authSecret.length < 32)
		errors.push('AUTH_SECRET must be at least 32 characters');
	const googleId = requireValue(environment, 'AUTH_GOOGLE_ID', errors);
	if (googleId && !GOOGLE_CLIENT_ID_PATTERN.test(googleId)) {
		errors.push('AUTH_GOOGLE_ID must be a valid Google OAuth client ID');
	}
	const googleSecret = requireValue(environment, 'AUTH_GOOGLE_SECRET', errors);
	if (googleSecret && googleSecret.length < 24) {
		errors.push('AUTH_GOOGLE_SECRET must be at least 24 characters');
	}
	if (environment.GOOGLE_CLIENT_ID && environment.GOOGLE_CLIENT_ID !== googleId) {
		errors.push('GOOGLE_CLIENT_ID conflicts with canonical AUTH_GOOGLE_ID');
	}
	if (environment.GOOGLE_CLIENT_SECRET && environment.GOOGLE_CLIENT_SECRET !== googleSecret) {
		errors.push('GOOGLE_CLIENT_SECRET conflicts with canonical AUTH_GOOGLE_SECRET');
	}

	if (environment.EMAIL_PROVIDER !== 'sendgrid') {
		errors.push('EMAIL_PROVIDER must be sendgrid in production');
	}
	requireValue(environment, 'SENDGRID_API_KEY', errors);
	const sender = requireValue(environment, 'SENDGRID_SENDER_EMAIL', errors);
	if (sender && !EMAIL_PATTERN.test(sender)) errors.push('SENDGRID_SENDER_EMAIL must be valid');

	const turnstileSecret = requireValue(environment, 'TURNSTILE_SECRET_KEY', errors);
	const turnstileSite = requireValue(environment, 'PUBLIC_TURNSTILE_SITE_KEY', errors);
	if (Boolean(turnstileSecret) !== Boolean(turnstileSite)) {
		errors.push('TURNSTILE_SECRET_KEY and PUBLIC_TURNSTILE_SITE_KEY must be configured together');
	}

	if (environment.CRON_ENABLED !== 'true') {
		errors.push('CRON_ENABLED must be explicitly true in production');
	}
	requireValue(environment, 'CRON_SECRET', errors);

	validateBase64Key(environment, 'ENCRYPTION_KEY', errors);
	const keyVersion = Number(requireValue(environment, 'ENCRYPTION_KEY_VERSION', errors));
	if (!Number.isSafeInteger(keyVersion) || keyVersion <= 0) {
		errors.push('ENCRYPTION_KEY_VERSION must be a positive integer');
	}
	for (const pepper of ['OTP_PEPPER', 'ACCOUNT_DELETION_PEPPER']) {
		const value = requireValue(environment, pepper, errors);
		if (value && value.length < 32) errors.push(`${pepper} must be at least 32 characters`);
	}

	const paymentProviders = requireValue(environment, 'PAYMENT_PROVIDERS', errors)
		?.split(',')
		.map((provider) => provider.trim())
		.filter(Boolean);
	for (const provider of paymentProviders ?? []) {
		if (!['stripe', 'btcpay'].includes(provider))
			errors.push(`Unsupported payment provider: ${provider}`);
	}
	if (paymentProviders?.includes('stripe')) {
		for (const name of [
			'STRIPE_SECRET_KEY',
			'STRIPE_WEBHOOK_SECRET',
			'STRIPE_PRICE_ID_PRO_MONTHLY',
			'STRIPE_PRICE_ID_PRO_YEARLY',
			'PUBLIC_STRIPE_PUBLISHABLE_KEY'
		]) {
			requireValue(environment, name, errors);
		}
	}
	if (paymentProviders?.includes('btcpay')) {
		for (const name of [
			'BTCPAY_SERVER_URL',
			'BTCPAY_API_KEY',
			'BTCPAY_STORE_ID',
			'BTCPAY_WEBHOOK_SECRET'
		]) {
			requireValue(environment, name, errors);
		}
	}

	const bitcoinEnrollmentEnabled = environment.BITCOIN_ENROLLMENT_ENABLED === 'true';
	const railwayEnvironment = environment.RAILWAY_ENVIRONMENT_NAME?.trim().toLowerCase();
	if (!['true', 'false'].includes(environment.BITCOIN_ENROLLMENT_ENABLED ?? '')) {
		errors.push('BITCOIN_ENROLLMENT_ENABLED must be explicitly true or false');
	}
	if (bitcoinEnrollmentEnabled && railwayEnvironment !== 'staging') {
		errors.push(
			'BITCOIN_ENROLLMENT_ENABLED may be true only in staging until the funded signet gate passes'
		);
	}
	if (environment.BITCOIN_NETWORK !== 'signet') {
		errors.push('BITCOIN_NETWORK must be signet while Bitcoin enrollment is gated');
	}

	if (environment.NOSTR_PUBLISHING_ENABLED !== 'true') {
		errors.push('NOSTR_PUBLISHING_ENABLED must be explicitly true in production');
	}
	const relayAllowlist = requireValue(environment, 'NOSTR_RELAY_ALLOWLIST', errors)
		?.split(',')
		.map((relay) => relay.trim())
		.filter(Boolean);
	if ((relayAllowlist?.length ?? 0) < 3) {
		errors.push('NOSTR_RELAY_ALLOWLIST must contain at least three relays');
	}
	for (const relay of relayAllowlist ?? []) {
		try {
			if (new URL(relay).protocol !== 'wss:') errors.push('Nostr relays must use wss://');
		} catch {
			errors.push('NOSTR_RELAY_ALLOWLIST contains an invalid URL');
		}
	}

	const revision = environment.RAILWAY_GIT_COMMIT_SHA || environment.APP_REVISION;
	if (!revision || !SHA_PATTERN.test(revision)) {
		errors.push('RAILWAY_GIT_COMMIT_SHA or APP_REVISION must be a 40-character commit SHA');
	}

	return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function assertProductionConfig(environment: NodeJS.ProcessEnv = process.env): void {
	const result = validateProductionConfig(environment);
	if (!result.valid) {
		throw new Error(`Production configuration is invalid: ${result.errors.join('; ')}`);
	}
}
