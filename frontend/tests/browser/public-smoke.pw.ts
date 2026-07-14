import { expect, test } from '@playwright/test';

test('liveness is process-only and readiness fails closed without PostgreSQL', async ({
	request
}) => {
	const live = await request.get('/api/health/live');
	expect(live.status()).toBe(200);
	expect(await live.json()).toMatchObject({ status: 'alive' });

	const ready = await request.get('/api/health/ready');
	expect(ready.status()).toBe(503);
	expect(await ready.json()).toMatchObject({ status: 'unavailable' });
});

test('public recovery and content routes enforce CSP', async ({ page }) => {
	for (const path of ['/', '/blog', '/faq', '/recover']) {
		const response = await page.goto(path);
		expect(response?.status(), path).toBe(200);

		const csp = response?.headers()['content-security-policy'];
		expect(csp, path).toBeTruthy();
		expect(csp, path).toContain("default-src 'self'");
		expect(csp, path).toContain("frame-ancestors 'none'");
		expect(response?.headers()['content-security-policy-report-only'], path).toBeUndefined();
	}
});

test('sign-in renders under CSP and does not bypass Turnstile', async ({ page }) => {
	const response = await page.goto('/sign-in');
	expect(response?.status()).toBe(200);

	const csp = response?.headers()['content-security-policy'];
	expect(csp).toContain("default-src 'self'");
	expect(csp).toContain("frame-ancestors 'none'");
	expect(response?.headers()['content-security-policy-report-only']).toBeUndefined();
	await expect(page).toHaveTitle(/KeyFate/i);
	await expect(page.getByRole('button', { name: 'Continue with Email' })).toBeDisabled();
	await expect(page.locator('body')).not.toContainText('Internal Error');
});

test('Nostr and Bitcoin recovery inputs stay on the browser recovery surface', async ({ page }) => {
	await page.goto('/recover');
	await expect(page.getByRole('heading', { name: 'Recover Your Shares' })).toBeVisible();
	await expect(page.getByRole('radio', { name: /Nostr/ })).toBeVisible();
	await expect(page.getByRole('radio', { name: /Bitcoin Timelock/ })).toBeVisible();
	await expect(page.getByText(/All decryption happens locally in your browser/)).toBeVisible();

	await page.getByRole('radio', { name: /Bitcoin Timelock/ }).click();
	await page.getByRole('button', { name: /Continue/ }).click();
	await expect(page.getByRole('heading', { name: 'Recover via Bitcoin' })).toBeVisible();
	await expect(page.getByLabel('Recipient Nostr Private Key (nsec)')).toBeVisible();
});
