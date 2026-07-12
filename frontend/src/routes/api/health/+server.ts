import type { RequestHandler } from './$types';
import { createReadinessResponse } from '$lib/server/health';

/** Compatibility alias for the readiness probe. */
export const GET: RequestHandler = async (event) =>
	createReadinessResponse(event.request, event.url);
