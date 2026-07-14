import { json } from '@sveltejs/kit';
import { connectionManager } from '$lib/db/connection-manager';
import { getEmailServiceHealth } from '$lib/email/email-service';
import { authorizeRequest } from '$lib/cron/utils';
import { logger } from '$lib/logger';
import { validateProductionConfig } from '$lib/server/production-config';

const READINESS_TIMEOUT_MS = 3_000;
const DATABASE_STATEMENT_TIMEOUT_MS = 2_500;
let databaseCheckInFlight: Promise<boolean> | null = null;

function getDatabaseCheck(): Promise<boolean> {
	if (databaseCheckInFlight) return databaseCheckInFlight;
	const check = connectionManager.healthCheck(DATABASE_STATEMENT_TIMEOUT_MS).finally(() => {
		if (databaseCheckInFlight === check) databaseCheckInFlight = null;
	});
	databaseCheckInFlight = check;
	return check;
}

async function checkDatabaseWithTimeout(): Promise<boolean> {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			getDatabaseCheck(),
			new Promise<boolean>((resolve) => {
				timeout = setTimeout(() => resolve(false), READINESS_TIMEOUT_MS);
			})
		]);
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}

export async function createReadinessResponse(request: Request, url: URL): Promise<Response> {
	const detailed = url.searchParams.get('detailed') === 'true';
	if (detailed && !authorizeRequest(request, url)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const config = validateProductionConfig();
		const databaseHealthy = config.valid ? await checkDatabaseWithTimeout() : false;
		const healthy = config.valid && databaseHealthy;

		if (!detailed) {
			return json({ status: healthy ? 'healthy' : 'unavailable' }, { status: healthy ? 200 : 503 });
		}

		const dbStats = connectionManager.getStats();
		return json(
			{
				status: healthy ? 'healthy' : 'unavailable',
				revision: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.APP_REVISION || 'unavailable',
				checks: {
					configuration: config.valid ? 'healthy' : 'unhealthy',
					database: databaseHealthy ? 'healthy' : 'unhealthy'
				},
				database: {
					connected: dbStats.connected,
					activeQueries: dbStats.activeQueries,
					totalConnections: dbStats.totalConnections,
					totalErrors: dbStats.totalErrors,
					isShuttingDown: dbStats.isShuttingDown
				},
				email: { circuitBreaker: getEmailServiceHealth() }
			},
			{ status: healthy ? 200 : 503 }
		);
	} catch (error) {
		logger.error('Readiness check failed', error instanceof Error ? error : undefined);
		return json({ status: 'unavailable' }, { status: 503 });
	}
}
