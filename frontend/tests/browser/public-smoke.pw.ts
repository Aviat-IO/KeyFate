import { expect, test } from '@playwright/test';

const KNOWN_V3_ENVELOPES = [
	'{"scheme":"keyfate-shamir-chacha20poly1305","version":3,"setId":"000102030405060708090a0b0c0d0e0f","threshold":2,"total":3,"index":1,"shareHex":"08018b8a898887868584838281807f7e7d7d7b557956775b75587359715a6f476d446b4d694e67436540634161425f7f5d7c5b455946574b55485349514a4f574d544b5d495e47534550435141523f2f3d2c","protectedSecret":{"cipher":"chacha20-poly1305","nonceHex":"303132333435363738393a3b","ciphertextHex":"a66d55dcf56457ef248c3555b76380b574d780827d28b2d04b7fa23b593c93d21a36e8a5ccffd959ef94e11fd7630915910ef75fb26d0170ec2ccd6ba6841611e69014cd8873b2e228ee1ce98d91a607dc9bad145ae0035d8403c4328d3197032cff5e03b0dc7bc8","ciphertextDigestHex":"f2f6e3d12e5e8a94633feec320277872fbb7b25af2fc713cf18f634e54a708b0"}}',
	'{"scheme":"keyfate-shamir-chacha20poly1305","version":3,"setId":"000102030405060708090a0b0c0d0e0f","threshold":2,"total":3,"index":2,"shareHex":"08020b090f0d131117151b191f1dfefcfaf9f6dbf2deeec1eac4e6cfe2cadef5daf0d6f3d2f6cee9caecc6e7c2e2be9dba98b6abb2aeaeb1aab4a6bfa2ba9e859a80968392868e998a9c869782927e6d7a68","protectedSecret":{"cipher":"chacha20-poly1305","nonceHex":"303132333435363738393a3b","ciphertextHex":"a66d55dcf56457ef248c3555b76380b574d780827d28b2d04b7fa23b593c93d21a36e8a5ccffd959ef94e11fd7630915910ef75fb26d0170ec2ccd6ba6841611e69014cd8873b2e228ee1ce98d91a607dc9bad145ae0035d8403c4328d3197032cff5e03b0dc7bc8","ciphertextDigestHex":"f2f6e3d12e5e8a94633feec320277872fbb7b25af2fc713cf18f634e54a708b0"}}'
];

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

test('authenticated recovery is default and legacy transport requires deliberate opt-in', async ({
	page
}) => {
	const response = await page.goto('/recover');
	expect(response?.headers()['cache-control']).toContain('no-store');
	expect(response?.headers()['referrer-policy']).toBe('no-referrer');
	await expect(page.getByRole('heading', { name: 'Recover Your Shares' })).toBeVisible();
	await expect(page.getByRole('radio', { name: /Nostr/ })).toBeVisible();
	await expect(page.getByRole('radio', { name: /Bitcoin Timelock/ })).not.toBeVisible();
	await expect(page.getByText(/Cryptography runs locally in this browser/)).toBeVisible();
	await page.getByRole('button', { name: /Continue/ }).click();
	await expect(page.getByRole('heading', { name: 'Authenticated Nostr Recovery' })).toBeVisible();
	await expect(page.getByLabel('Owner-delivered setup bundle')).toBeVisible();
	await expect(
		page.getByRole('button', { name: /Fetch, verify, and recover envelope/ })
	).toBeDisabled();
	await page.getByRole('button', { name: 'Back' }).click();

	await page.getByLabel('Unverified legacy transport mode').click();
	await expect(page.getByRole('radio', { name: /Nostr/ })).toBeVisible();
	await expect(page.getByRole('radio', { name: /Bitcoin Timelock/ })).toBeVisible();
	await page.getByRole('radio', { name: /Nostr/ }).click();
	await page.getByRole('button', { name: /Continue/ }).click();
	const legacyWarning = page
		.getByRole('alert')
		.filter({ hasText: 'Unverified legacy Nostr recovery' });
	await expect(legacyWarning).toBeVisible();
	await expect(legacyWarning).toContainText('never selected as a fallback from v3');
	await page.getByRole('button', { name: 'Back' }).click();
	await page.getByRole('radio', { name: /Bitcoin Timelock/ }).click();
	await page.getByRole('button', { name: /Continue/ }).click();
	await expect(page.getByRole('heading', { name: 'Recover via Bitcoin' })).toBeVisible();
	await expect(page.getByLabel('Recipient Nostr Private Key (nsec)')).toBeVisible();
});

test('authenticated v3 reconstruction rejects downgrade and releases only known plaintext', async ({
	page
}) => {
	await page.goto('/decrypt');
	const first = page.getByLabel('Recovery share 1');
	const second = page.getByLabel('Recovery share 2');
	const invalidV3 = JSON.stringify({ ...JSON.parse(KNOWN_V3_ENVELOPES[0]), version: 2 });
	await first.fill(invalidV3);
	await second.fill(KNOWN_V3_ENVELOPES[1]);
	await page.getByRole('button', { name: 'Recover Authenticated Secret' }).click();
	await expect(page.getByText(/not retried as legacy material/)).toBeVisible();
	await expect(page.getByText('known-answer 🔐')).not.toBeVisible();

	await first.fill(KNOWN_V3_ENVELOPES[0]);
	await page.getByRole('button', { name: 'Recover Authenticated Secret' }).click();
	await expect(page.getByText('Authenticated Secret Recovered')).toBeVisible();
	await expect(page.locator('textarea[readonly]')).toHaveValue('known-answer 🔐\nline two');
});

test('decrypt ignores URL recovery material and disables referrers and caching', async ({
	page
}) => {
	const response = await page.goto('/decrypt?share=should-never-be-consumed');
	expect(response?.headers()['cache-control']).toContain('no-store');
	expect(response?.headers()['referrer-policy']).toBe('no-referrer');
	await expect(page.getByText('should-never-be-consumed')).not.toBeVisible();
	await expect(page.getByText('Authenticated v3 recovery')).toBeVisible();
});
