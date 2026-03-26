import type { PageServerLoad } from './$types';
import {
	getSecretStatusCounts,
	getUserCounts,
	getEmailDeliveryStats,
	getFailedSecrets,
	getRecentEmailFailures,
	getRecentActivity
} from '$lib/db/queries/admin-metrics';
import { cronMonitor } from '$lib/monitoring/cron-monitor';

export const load: PageServerLoad = async () => {
	try {
		const [secretCounts, userCounts, emailStats, failedSecrets, emailFailures, recentActivity] =
			await Promise.all([
				getSecretStatusCounts(),
				getUserCounts(),
				getEmailDeliveryStats(),
				getFailedSecrets(),
				getRecentEmailFailures(),
				getRecentActivity()
			]);

		const cronStats = cronMonitor.getAllStats();

		return {
			secretCounts,
			userCounts,
			emailStats,
			failedSecrets,
			emailFailures,
			recentActivity,
			cronStats
		};
	} catch (err) {
		console.error('[Admin] Failed to load admin metrics:', err);
		return {
			secretCounts: { active: 0, paused: 0, triggered: 0, failed: 0, total: 0 },
			userCounts: { total: 0, withActiveSecrets: 0, proUsers: 0 },
			emailStats: { sent: 0, failed: 0, pending: 0, sentLast24h: 0, failedLast24h: 0 },
			failedSecrets: [],
			emailFailures: [],
			recentActivity: [],
			cronStats: {}
		};
	}
};
