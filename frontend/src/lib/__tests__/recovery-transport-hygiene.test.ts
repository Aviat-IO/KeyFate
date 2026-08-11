import { describe, expect, it } from 'bun:test';

const root = new URL('../../', import.meta.url);
async function source(relative: string) {
	return Bun.file(new URL(relative, root)).text();
}

describe('recovery transport hygiene', () => {
	it('never consumes recovery shares from /decrypt query parameters', async () => {
		const page = await source('routes/decrypt/+page.svelte');
		expect(page).not.toContain('$page.url.searchParams');
		expect(page).not.toMatch(/share\d|searchParams\.get\(['"`]share/);
		expect(page).toContain('query parameters is ignored');
	});
	it('does not generate share-bearing mailto URIs', async () => {
		const instructions = await source(
			'routes/(authenticated)/secrets/[id]/share-instructions/+page.svelte'
		);
		expect(instructions).not.toContain('createMailto');
		expect(instructions).not.toContain('mailto:');
		expect(instructions).toMatch(/never\s+placed in a URL or generated email link/i);
	});
	it('keeps setup metadata out of URLs and applies no-store/no-referrer to recovery paths', async () => {
		const hooks = await source('hooks.server.ts');
		const creation = await source('lib/components/NewSecretForm.svelte');
		expect(creation).toContain('goto(`/secrets/${result.secretId}/share-instructions`)');
		expect(creation).not.toContain('sss_shares_total:');
		expect(creation).not.toContain('recipients: encodeURIComponent');
		expect(hooks).toContain("pathname.startsWith('/recover/')");
		expect(hooks).toContain('share-instructions');
		expect(hooks).toContain("'Cache-Control', 'private, no-store, max-age=0'");
		expect(hooks).toContain("'Referrer-Policy', 'no-referrer'");
	});
	it('fetches fresh single-use CSRF tokens for registration and finalization', async () => {
		const creation = await source('lib/components/NewSecretForm.svelte');
		const instructions = await source(
			'routes/(authenticated)/secrets/[id]/share-instructions/+page.svelte'
		);
		expect(creation).toContain('const registrationToken = await getCsrfToken()');
		expect(instructions).toContain('const registrationToken = await getCsrfToken()');
		expect(instructions).toContain('const finalizationToken = await getCsrfToken()');
		expect(instructions).not.toContain("'x-csrf-token': token");
	});
	it('keeps v3 recovery default and raw combine behind explicit legacy mode', async () => {
		const decryptor = await source('lib/components/SSSDecryptor.svelte');
		expect(decryptor).toContain('recoverAuthenticatedSecret(validShares)');
		expect(decryptor).toMatch(/legacyMode\s*\?\s*recoverLegacy\(validShares\)/);
		expect(decryptor).toMatch(/Failed v3 input is never\s+downgraded automatically/);
		expect(decryptor).toContain('Unverified Legacy Result');
	});
	it('keeps combined Bitcoin enrollment paused until Nostr bundle finalization is ready', async () => {
		const bitcoinStore = await source('routes/api/secrets/[id]/store-bitcoin/+server.ts');
		expect(bitcoinStore).toContain("secret.nostrDeliveryStatus === 'ready'");
		expect(bitcoinStore).not.toContain("secret.nostrDeliveryStatus !== 'pending'");
	});
	it('states the browser-origin trust boundary accurately', async () => {
		const decryptor = await source('lib/components/SSSDecryptor.svelte');
		const recover = await source('routes/recover/+page.svelte');
		expect(decryptor).toContain('browser origin can still observe');
		expect(recover).toMatch(/browser origin can observe\s+plaintext/);
		expect(recover).not.toContain('no data is sent to any server');
	});
});
