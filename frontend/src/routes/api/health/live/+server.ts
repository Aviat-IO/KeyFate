import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Process-only liveness probe: intentionally performs no dependency I/O. */
export const GET: RequestHandler = async () =>
	json({ status: 'alive', timestamp: new Date().toISOString() });
