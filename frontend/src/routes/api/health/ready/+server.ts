import type { RequestHandler } from './$types';
import { createReadinessResponse } from '$lib/server/health';

export const GET: RequestHandler = async (event) =>
	createReadinessResponse(event.request, event.url);
