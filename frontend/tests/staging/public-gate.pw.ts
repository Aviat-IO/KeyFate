import { expect, test } from '@playwright/test';

test('staging exposes healthy probes and enforcing CSP', async ({ page, request }) => {
	const live = await request.get('/api/health/live');
	expect(live.status()).toBe(200);
	expect(await live.json()).toMatchObject({ status: 'alive' });

	const ready = await request.get('/api/health/ready');
	expect(ready.status()).toBe(200);
	expect(await ready.json()).toMatchObject({ status: 'healthy' });

	const response = await page.goto('/sign-in');
	expect(response?.status()).toBe(200);
	const csp = response?.headers()['content-security-policy'];
	expect(csp).toContain("default-src 'self'");
	expect(csp).toContain("frame-ancestors 'none'");
	expect(response?.headers()['content-security-policy-report-only']).toBeUndefined();
});
