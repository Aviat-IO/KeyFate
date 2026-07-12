import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const removedRoutes = [
	'src/routes/api/decrypt/+server.ts',
	'src/routes/api/secrets/[id]/export-share/+server.ts',
	'src/routes/api/secrets/[id]/reveal-server-share/+server.ts',
	'src/routes/api/secrets/[id]/server-share/+server.ts'
];

describe('removed plaintext recovery routes', () => {
	for (const route of removedRoutes) {
		it(`keeps ${route} unavailable`, () => {
			expect(existsSync(resolve(process.cwd(), route))).toBe(false);
		});
	}
});
