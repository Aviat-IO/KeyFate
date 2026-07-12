import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'base-uri': ['self'],
				'object-src': ['none'],
				'frame-ancestors': ['none'],
				'form-action': ['self'],
				'script-src': ['self', 'https://challenges.cloudflare.com'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'https:'],
				'font-src': ['self', 'data:'],
				'frame-src': ['self', 'https://challenges.cloudflare.com'],
				'connect-src': [
					'self',
					'https://challenges.cloudflare.com',
					'https://mempool.space',
					'https://blockstream.info',
					'https://api.coingecko.com',
					'wss://relay.damus.io',
					'wss://relay.nostr.band',
					'wss://nos.lol',
					'wss://relay.snort.social',
					'wss://nostr.wine',
					'wss://relay.primal.net',
					'wss://nostr.mom',
					'wss://relay.nostr.bg',
					'wss://nostr-pub.wellorder.net',
					'wss://nostr.oxtr.dev'
				],
				'worker-src': ['self', 'blob:'],
				'manifest-src': ['self']
			}
		},
		alias: {
			$components: 'src/components',
			'$components/*': 'src/components/*'
		}
	}
};

export default config;
