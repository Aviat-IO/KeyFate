import { json } from '@sveltejs/kit';
import { checkDatabaseConnection } from '$lib/db/connection';
import { getDatabaseStats } from '$lib/db/drizzle';
import { getEmailServiceHealth } from '$lib/email/email-service';
import { authorizeRequest } from '$lib/cron/utils';
import { logger } from '$lib/logger';

const READINESS_TIMEOUT_MS = 3_000;

function checkEmailConfigured(): boolean {
	return Boolean(process.env.SENDGRID_API_KEY);
}

function checkEncryptionKey(): boolean {
	try {
		const key = process.env.ENCRYPTION_KEY;
		return Boolean(key) && Buffer.from(key!, 'base64').length === 32;
	} catch {
		return false;
	}
}

async function checkDatabaseWithTimeout(): Promise<boolean> {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			checkDatabaseConnection(),
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
		const dbConnected = await checkDatabaseWithTimeout();
		const emailConfigured = checkEmailConfigured();
		const encryptionKeyValid = checkEncryptionKey();
		const healthy = dbConnected && emailConfigured && encryptionKeyValid;
		const checks = {
			database: dbConnected ? 'healthy' : 'unhealthy',
			email: emailConfigured ? 'configured' : 'unconfigured',
			encryption: encryptionKeyValid ? 'healthy' : 'unhealthy'
		};
		const dbStats = getDatabaseStats();
		const emailCircuitStats = getEmailServiceHealth();

		return json(
			{
				status: healthy ? 'healthy' : 'degraded',
				timestamp: new Date().toISOString(),
				checks,
				...(detailed && {
					environment: process.env.NODE_ENV || 'unknown',
					region: process.env.RAILWAY_REGION || 'unknown',
					version: {
						deploymentHash:
							process.env.RAILWAY_DEPLOYMENT_ID || process.env.DEPLOYMENT_HASH || 'unknown',
						gitCommit: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown'
					},
					database: {
						connected: dbStats.connected,
						activeQueries: dbStats.activeQueries,
						totalConnections: dbStats.totalConnections,
						totalErrors: dbStats.totalErrors,
						circuitBreakerOpen: dbStats.circuitBreakerOpen,
						isShuttingDown: dbStats.isShuttingDown
					},
					email: { circuitBreaker: emailCircuitStats }
				})
			},
			{ status: healthy ? 200 : 503 }
		);
	} catch (error) {
		logger.error('Readiness check failed', error instanceof Error ? error : undefined);
		return json({ status: 'error', timestamp: new Date().toISOString() }, { status: 500 });
	}
}
