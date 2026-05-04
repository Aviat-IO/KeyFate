import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const libPath = fileURLToPath(new URL('./src/lib', import.meta.url));

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			$lib: libPath,
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
			$lib: libPath
		}
	}
});
