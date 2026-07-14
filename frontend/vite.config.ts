import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			buffer: 'buffer/'
		}
	},
	define: {
		'globalThis.Buffer': 'globalThis.Buffer'
	},
	optimizeDeps: {
		include: ['buffer', 'shamirs-secret-sharing']
	}
});
