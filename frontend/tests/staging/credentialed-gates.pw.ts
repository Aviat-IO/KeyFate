import { expect, test } from '@playwright/test';

const credentialed = process.env.STAGING_CREDENTIALS_READY === 'true';
const storageState = process.env.STAGING_E2E_STORAGE_STATE;
const secretId = process.env.STAGING_TEST_SECRET_ID;

/**
 * These cases are deliberately skipped until a human supplies the staging-only
 * storage state and provider fixtures. They make the required journeys
 * executable without treating repository CI as credentialed evidence.
 */
test.describe('credentialed staging journeys', () => {
	test.skip(
		!credentialed || !storageState,
		'Set STAGING_CREDENTIALS_READY=true and STAGING_E2E_STORAGE_STATE to approved staging fixtures'
	);
	test.use({ storageState: storageState || undefined });

	test('authenticated secret creation and encrypted owner-kit flow is reachable', async ({
		page
	}) => {
		await page.goto('/secrets/new');
		await expect(page).toHaveURL(/\/secrets\/new$/);
		await expect(page.getByRole('heading', { name: /create new secret/i })).toBeVisible();
		await expect(page.getByLabel(/secret message/i)).toBeVisible();
	});

	test('data export flow is reachable for the authenticated owner', async ({ page }) => {
		await page.goto('/profile');
		await expect(page).toHaveURL(/\/profile$/);
		await expect(page.getByText(/export/i).first()).toBeVisible();
	});

	test('Nostr and Bitcoin recovery surfaces are reachable for the staged secret', async ({
		page
	}) => {
		test.skip(!secretId, 'Set STAGING_TEST_SECRET_ID to a staged recovery fixture');
		await page.goto(`/secrets/${secretId}/view`);
		await expect(page).toHaveURL(new RegExp(`/secrets/${secretId}/view$`));
		await expect(page.getByText(/bitcoin timelock/i)).toBeVisible();
	});
});
