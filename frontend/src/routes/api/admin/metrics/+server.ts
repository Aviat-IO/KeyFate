import { json, error } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireAdmin } from "$lib/auth/admin-guard"
import {
	getSecretStatusCounts,
	getUserCounts,
	getEmailDeliveryStats,
	getFailedSecrets,
	getRecentEmailFailures,
	getRecentActivity,
} from "$lib/db/queries/admin-metrics"
import { cronMonitor } from "$lib/monitoring/cron-monitor"

export const GET: RequestHandler = async (event) => {
	const session = await event.locals.auth()
	requireAdmin(session)

	const [secretCounts, userCounts, emailStats, failedSecrets, emailFailures, recentActivity] =
		await Promise.all([
			getSecretStatusCounts(),
			getUserCounts(),
			getEmailDeliveryStats(),
			getFailedSecrets(),
			getRecentEmailFailures(),
			getRecentActivity(),
		])

	const cronStats = cronMonitor.getAllStats()

	return json({
		secretCounts,
		userCounts,
		emailStats,
		failedSecrets,
		emailFailures,
		recentActivity,
		cronStats,
	})
}
