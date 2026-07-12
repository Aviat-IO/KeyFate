import { describe, expect, it } from 'vitest';
import config from '../../../svelte.config.js';

describe('SvelteKit CSP configuration', () => {
	it('enforces a nonce/hash-capable policy with restrictive defaults', () => {
		expect(config.kit?.csp?.mode).toBe('auto');
		expect(config.kit?.csp?.directives).toMatchObject({
			'default-src': ['self'],
			'base-uri': ['self'],
			'object-src': ['none'],
			'frame-ancestors': ['none'],
			'form-action': ['self']
		});
	});

	it('allows only the required interactive external origins', () => {
		const directives = config.kit?.csp?.directives;
		expect(directives?.['script-src']).toEqual(['self', 'https://challenges.cloudflare.com']);
		expect(directives?.['frame-src']).toContain('https://challenges.cloudflare.com');
		expect(directives?.['connect-src']).toEqual(
			expect.arrayContaining([
				'self',
				'https://mempool.space',
				'https://blockstream.info',
				'wss://relay.damus.io',
				'wss://relay.nostr.band'
			])
		);
	});
});
