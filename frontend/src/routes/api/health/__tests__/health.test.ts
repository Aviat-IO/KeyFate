import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectionManager } from '$lib/db/connection-manager';
import { GET } from '../+server';

function createHealthEvent(options: { detailed?: boolean; authorized?: boolean } = {}) {
	const url = new URL('http://localhost:5173/api/health');
	if (options.detailed) url.searchParams.set('detailed', 'true');

	const headers = new Headers();
	if (options.authorized) headers.set('authorization', `Bearer ${process.env.CRON_SECRET}`);

	return {
		request: new Request(url, { headers }),
		url
	} as never;
}

describe('GET /api/health readiness compatibility alias', () => {
	let healthCheck: () => Promise<boolean>;
	let originalEnvironment: NodeJS.ProcessEnv;

	beforeEach(() => {
		originalEnvironment = { ...process.env };
		process.env.NODE_ENV = 'test';
		process.env.CRON_SECRET = 'test-cron-secret-at-least-32-characters';
		healthCheck = () => Promise.resolve(true);
		vi.spyOn(connectionManager, 'healthCheck').mockImplementation(() => healthCheck());
	});

	afterEach(() => {
		for (const name of Object.keys(process.env)) delete process.env[name];
		Object.assign(process.env, originalEnvironment);
		vi.restoreAllMocks();
	});

	it('returns the minimal healthy readiness response', async () => {
		const response = await GET(createHealthEvent());

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: 'healthy' });
	});

	it('fails closed when the database is unavailable', async () => {
		healthCheck = () => Promise.resolve(false);

		const response = await GET(createHealthEvent());

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ status: 'unavailable' });
	});

	it('shares one in-flight database probe across concurrent readiness requests', async () => {
		let resolveHealth: ((healthy: boolean) => void) | undefined;
		healthCheck = () =>
			new Promise<boolean>((resolve) => {
				resolveHealth = resolve;
			});

		const first = GET(createHealthEvent());
		const second = GET(createHealthEvent());
		await Promise.resolve();
		resolveHealth?.(true);

		const responses = await Promise.all([first, second]);
		expect(responses.map((response) => response.status)).toEqual([200, 200]);
		expect(connectionManager.healthCheck).toHaveBeenCalledTimes(1);
	});

	it('does not expose detailed dependency data without cron authorization', async () => {
		const response = await GET(createHealthEvent({ detailed: true }));

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
	});

	it('returns bounded dependency details to an authorized operator', async () => {
		process.env.APP_REVISION = 'a'.repeat(40);

		const response = await GET(createHealthEvent({ detailed: true, authorized: true }));
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toMatchObject({
			status: 'healthy',
			revision: 'a'.repeat(40),
			checks: {
				configuration: 'healthy',
				database: 'healthy'
			}
		});
		expect(data.database).toBeDefined();
		expect(data.email).toBeDefined();
	});

	it('returns unavailable without leaking an unexpected database error', async () => {
		healthCheck = () => Promise.reject(new Error('database credentials leaked'));

		const response = await GET(createHealthEvent());

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ status: 'unavailable' });
	});
});
