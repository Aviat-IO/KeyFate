import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

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
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		setupFiles: ['src/test/setup.ts'],
		globals: true,
		alias: {
			// Ensure $lib resolves correctly in tests
			$lib: path.resolve(dirname, 'src/lib'),
			'$lib/*': path.resolve(dirname, 'src/lib/*')
		}
	}
});
