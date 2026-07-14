import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_EXTERNAL_BASE_URL;
const localWebServerEnv = {
	NODE_ENV: 'production',
	DATABASE_URL: 'postgresql://keyfate:keyfate@127.0.0.1:1/keyfate?sslmode=verify-full',
	ORIGIN: 'https://keyfate.test',
	PUBLIC_SITE_URL: 'https://keyfate.test',
	AUTH_SECRET: 'test-auth-secret-at-least-32-characters',
	AUTH_GOOGLE_ID: 'test.apps.googleusercontent.com',
	AUTH_GOOGLE_SECRET: 'test-google-secret-at-least-24-characters',
	EMAIL_PROVIDER: 'sendgrid',
	SENDGRID_API_KEY: 'SG.test',
	SENDGRID_SENDER_EMAIL: 'noreply@keyfate.test',
	TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
	PUBLIC_TURNSTILE_SITE_KEY: 'test-turnstile-site',
	CRON_ENABLED: 'true',
	CRON_SECRET: 'test-cron-secret-at-least-32-characters',
	ENCRYPTION_KEY: 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
	ENCRYPTION_KEY_VERSION: '1',
	OTP_PEPPER: 'test-otp-pepper-at-least-32-characters',
	ACCOUNT_DELETION_PEPPER: 'test-deletion-pepper-at-least-32-chars',
	PAYMENT_PROVIDERS: 'stripe',
	STRIPE_SECRET_KEY: 'sk_test_ci',
	STRIPE_WEBHOOK_SECRET: 'whsec_ci',
	STRIPE_PRICE_ID_PRO_MONTHLY: 'price_monthly',
	STRIPE_PRICE_ID_PRO_YEARLY: 'price_yearly',
	PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_ci',
	BITCOIN_ENROLLMENT_ENABLED: 'false',
	BITCOIN_NETWORK: 'signet',
	NOSTR_PUBLISHING_ENABLED: 'true',
	NOSTR_RELAY_ALLOWLIST: 'wss://relay-1.test,wss://relay-2.test,wss://relay-3.test',
	APP_REVISION: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
};

export default defineConfig({
	testDir: './tests',
	testMatch: '**/*.pw.ts',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
	use: {
		baseURL: externalBaseUrl || 'http://127.0.0.1:4173',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure'
	},
	webServer: externalBaseUrl
		? undefined
		: {
				command: 'bun run build && bun run preview -- --host 127.0.0.1 --port 4173',
				env: localWebServerEnv,
				url: 'http://127.0.0.1:4173/api/health/live',
				reuseExistingServer: !process.env.CI,
				timeout: 120_000
			},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
