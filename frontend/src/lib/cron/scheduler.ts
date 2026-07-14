import cron from 'node-cron';
import { connectionManager } from '$lib/db/connection-manager';
import { logger } from '$lib/logger';

interface CronResult {
	processed: number;
	succeeded: number;
	failed: number;
}

interface CronJob {
	name: string;
	schedule: string;
	handler: () => Promise<CronResult>;
}

const runningJobs = new Map<string, Promise<void>>();
const scheduledTasks: ReturnType<typeof cron.schedule>[] = [];

function getCronJobs(): CronJob[] {
	return [
		{
			name: 'check-secrets',
			schedule: '*/15 * * * *',
			handler: async () => (await import('./check-secrets')).runCheckSecrets()
		},
		{
			name: 'process-reminders',
			schedule: '*/15 * * * *',
			handler: async () => (await import('./process-reminders')).runProcessReminders()
		},
		{
			name: 'process-exports',
			schedule: '0 2 * * *',
			handler: async () => (await import('./process-exports')).runProcessExports()
		},
		{
			name: 'process-deletions',
			schedule: '0 3 * * *',
			handler: async () => (await import('./process-deletions')).runProcessDeletions()
		},
		{
			name: 'process-subscription-downgrades',
			schedule: '0 4 * * *',
			handler: async () =>
				(await import('./process-subscription-downgrades')).runProcessSubscriptionDowngrades()
		},
		{
			name: 'cleanup-tokens',
			schedule: '0 5 * * *',
			handler: async () => (await import('./cleanup-tokens')).runCleanupTokens()
		},
		{
			name: 'confirm-utxos',
			schedule: '*/10 * * * *',
			handler: async () => (await import('./confirm-utxos')).confirmPendingUtxos()
		},
		{
			name: 'cleanup-exports',
			schedule: '0 6 * * *',
			handler: async () => (await import('./cleanup-exports')).runCleanupExports()
		}
	];
}

async function invokeCronJob(job: CronJob): Promise<void> {
	if (runningJobs.has(job.name)) {
		logger.warn('Cron invocation skipped because the local job is still running', {
			jobName: job.name
		});
		return;
	}

	const execution = connectionManager.withReservedConnection(async (connection) => {
		const lockKey = `keyfate:cron:${job.name}`;
		const [lock] = await connection<{ acquired: boolean }[]>`
			select pg_try_advisory_lock(hashtextextended(${lockKey}, 0)) as acquired
		`;
		if (!lock?.acquired) {
			logger.info('Cron invocation skipped because another replica owns the job', {
				jobName: job.name
			});
			return;
		}

		try {
			const result = await job.handler();
			logger.info('Cron job completed', {
				jobName: job.name,
				processed: result.processed ?? 0,
				succeeded: result.succeeded ?? 0,
				failed: result.failed ?? 0
			});
		} catch (error) {
			logger.error('Cron job failed', error instanceof Error ? error : undefined, {
				jobName: job.name
			});
		} finally {
			await connection`select pg_advisory_unlock(hashtextextended(${lockKey}, 0))`;
		}
	});

	runningJobs.set(job.name, execution);
	try {
		await execution;
	} finally {
		runningJobs.delete(job.name);
	}
}

export function startScheduler(): void {
	if (process.env.CRON_ENABLED !== 'true') {
		logger.info('Cron scheduler disabled', { explicitlyEnabled: false });
		return;
	}
	if (scheduledTasks.length > 0) return;

	for (const job of getCronJobs()) {
		const task = cron.schedule(job.schedule, () => {
			void invokeCronJob(job);
		});
		scheduledTasks.push(task);
	}
	logger.info('Cron scheduler started', { jobCount: scheduledTasks.length });
}

export async function stopScheduler(drainTimeoutMs: number = 10_000): Promise<void> {
	for (const task of scheduledTasks) task.stop();
	scheduledTasks.length = 0;

	const active = [...runningJobs.values()];
	if (active.length > 0) {
		let timeout: ReturnType<typeof setTimeout> | undefined;
		try {
			await Promise.race([
				Promise.allSettled(active),
				new Promise<void>((resolve) => {
					timeout = setTimeout(resolve, drainTimeoutMs);
				})
			]);
		} finally {
			if (timeout) clearTimeout(timeout);
		}
	}
	logger.info('Cron scheduler stopped', { remainingJobs: runningJobs.size });
}
