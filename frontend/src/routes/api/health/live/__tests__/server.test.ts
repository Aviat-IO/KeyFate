import { describe, expect, it, vi } from 'vitest';

vi.mock('@sveltejs/kit', () => ({
	json: (data: unknown, init?: { status?: number }) =>
		new Response(JSON.stringify(data), {
			status: init?.status ?? 200,
			headers: { 'content-type': 'application/json' }
		})
}));

describe('GET /api/health/live', () => {
	it('reports process liveness without an event or dependency', async () => {
		const { GET } = await import('../+server');
		const response = await GET({} as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.status).toBe('alive');
		expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
	});
});
