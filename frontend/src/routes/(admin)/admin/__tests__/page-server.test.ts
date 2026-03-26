import { describe, it, expect, vi, beforeEach } from "vitest"

// --- Mocks (must be declared before vi.mock calls) ---

const mockGetSecretStatusCounts = vi.fn()
const mockGetUserCounts = vi.fn()
const mockGetEmailDeliveryStats = vi.fn()
const mockGetFailedSecrets = vi.fn()
const mockGetRecentEmailFailures = vi.fn()
const mockGetRecentActivity = vi.fn()

vi.mock("$lib/db/queries/admin-metrics", () => ({
	getSecretStatusCounts: (...args: unknown[]) => mockGetSecretStatusCounts(...args),
	getUserCounts: (...args: unknown[]) => mockGetUserCounts(...args),
	getEmailDeliveryStats: (...args: unknown[]) => mockGetEmailDeliveryStats(...args),
	getFailedSecrets: (...args: unknown[]) => mockGetFailedSecrets(...args),
	getRecentEmailFailures: (...args: unknown[]) => mockGetRecentEmailFailures(...args),
	getRecentActivity: (...args: unknown[]) => mockGetRecentActivity(...args),
}))

const mockGetAllStats = vi.fn()
vi.mock("$lib/monitoring/cron-monitor", () => ({
	cronMonitor: { getAllStats: (...args: unknown[]) => mockGetAllStats(...args) },
}))

vi.mock("../$types", () => ({}))

// --- Import under test ---

import { load } from "../+page.server"

// Helper to assert load() returned data (it always does, even in catch block)
async function loadAdmin() {
	const result = await load({} as Parameters<typeof load>[0])
	if (!result) throw new Error("load returned void unexpectedly")
	return result
}

// --- Fixtures ---

const MOCK_SECRET_COUNTS = { active: 10, paused: 3, triggered: 1, failed: 2, total: 16 }
const MOCK_USER_COUNTS = { total: 50, withActiveSecrets: 12, proUsers: 5 }
const MOCK_EMAIL_STATS = {
	sent: 200,
	failed: 4,
	pending: 10,
	sentLast24h: 15,
	failedLast24h: 1,
}
const MOCK_FAILED_SECRETS = [
	{
		id: "sec_1",
		title: "My Secret",
		ownerEmail: "user@example.com",
		lastError: "Delivery timeout",
		updatedAt: new Date("2026-03-01"),
		retryCount: 3,
	},
]
const MOCK_EMAIL_FAILURES = [
	{
		id: "ef_1",
		email: "bounce@example.com",
		errorCode: "550",
		createdAt: new Date("2026-03-07"),
		resolvedAt: null,
	},
]
const MOCK_RECENT_ACTIVITY = [
	{
		id: "ch_1",
		secretId: "sec_2",
		userId: "usr_1",
		userEmail: "active@example.com",
		checkedInAt: new Date("2026-03-08"),
		nextCheckIn: new Date("2026-03-15"),
		createdAt: new Date("2026-03-08"),
	},
]
const MOCK_CRON_STATS = {
	"check-in-monitor": { lastRun: "2026-03-08T00:00:00Z", successCount: 42 },
	"email-retry": { lastRun: "2026-03-08T00:05:00Z", successCount: 10 },
}

const FALLBACK_SECRET_COUNTS = { active: 0, paused: 0, triggered: 0, failed: 0, total: 0 }
const FALLBACK_USER_COUNTS = { total: 0, withActiveSecrets: 0, proUsers: 0 }
const FALLBACK_EMAIL_STATS = { sent: 0, failed: 0, pending: 0, sentLast24h: 0, failedLast24h: 0 }

// --- Tests ---

describe("Admin page.server load", () => {
	beforeEach(() => {
		vi.clearAllMocks()

		mockGetSecretStatusCounts.mockResolvedValue(MOCK_SECRET_COUNTS)
		mockGetUserCounts.mockResolvedValue(MOCK_USER_COUNTS)
		mockGetEmailDeliveryStats.mockResolvedValue(MOCK_EMAIL_STATS)
		mockGetFailedSecrets.mockResolvedValue(MOCK_FAILED_SECRETS)
		mockGetRecentEmailFailures.mockResolvedValue(MOCK_EMAIL_FAILURES)
		mockGetRecentActivity.mockResolvedValue(MOCK_RECENT_ACTIVITY)
		mockGetAllStats.mockReturnValue(MOCK_CRON_STATS)
	})

	describe("happy path", () => {
		it("returns all metrics data from queries and cronMonitor", async () => {
			const result = await loadAdmin()

			expect(result).toEqual({
				secretCounts: MOCK_SECRET_COUNTS,
				userCounts: MOCK_USER_COUNTS,
				emailStats: MOCK_EMAIL_STATS,
				failedSecrets: MOCK_FAILED_SECRETS,
				emailFailures: MOCK_EMAIL_FAILURES,
				recentActivity: MOCK_RECENT_ACTIVITY,
				cronStats: MOCK_CRON_STATS,
			})
		})

		it("calls all six query functions", async () => {
			await loadAdmin()

			expect(mockGetSecretStatusCounts).toHaveBeenCalledOnce()
			expect(mockGetUserCounts).toHaveBeenCalledOnce()
			expect(mockGetEmailDeliveryStats).toHaveBeenCalledOnce()
			expect(mockGetFailedSecrets).toHaveBeenCalledOnce()
			expect(mockGetRecentEmailFailures).toHaveBeenCalledOnce()
			expect(mockGetRecentActivity).toHaveBeenCalledOnce()
		})

		it("calls cronMonitor.getAllStats()", async () => {
			await loadAdmin()

			expect(mockGetAllStats).toHaveBeenCalledOnce()
		})

		it("returns cronStats from cronMonitor.getAllStats()", async () => {
			const customStats = { "my-job": { runs: 99 } }
			mockGetAllStats.mockReturnValue(customStats)

			const result = await loadAdmin()

			expect(result.cronStats).toBe(customStats)
		})
	})

	describe("return shape", () => {
		it("has all expected top-level keys", async () => {
			const result = await loadAdmin()

			expect(Object.keys(result).sort()).toEqual([
				"cronStats",
				"emailFailures",
				"emailStats",
				"failedSecrets",
				"recentActivity",
				"secretCounts",
				"userCounts",
			])
		})
	})

	describe("error handling", () => {
		it("returns fallback zeroed data when getSecretStatusCounts throws", async () => {
			mockGetSecretStatusCounts.mockRejectedValue(new Error("DB connection lost"))

			const result = await loadAdmin()

			expect(result.secretCounts).toEqual(FALLBACK_SECRET_COUNTS)
			expect(result.userCounts).toEqual(FALLBACK_USER_COUNTS)
			expect(result.emailStats).toEqual(FALLBACK_EMAIL_STATS)
			expect(result.failedSecrets).toEqual([])
			expect(result.emailFailures).toEqual([])
			expect(result.recentActivity).toEqual([])
			expect(result.cronStats).toEqual({})
		})

		it("returns fallback data when getUserCounts throws", async () => {
			mockGetUserCounts.mockRejectedValue(new Error("query timeout"))

			const result = await loadAdmin()

			expect(result.secretCounts).toEqual(FALLBACK_SECRET_COUNTS)
			expect(result.userCounts).toEqual(FALLBACK_USER_COUNTS)
		})

		it("returns fallback data when getRecentActivity throws", async () => {
			mockGetRecentActivity.mockRejectedValue(new Error("table missing"))

			const result = await loadAdmin()

			expect(result.recentActivity).toEqual([])
		})

		it("logs error to console.error on failure", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const dbError = new Error("DB exploded")
			mockGetSecretStatusCounts.mockRejectedValue(dbError)

			await loadAdmin()

			expect(consoleSpy).toHaveBeenCalledOnce()
			expect(consoleSpy).toHaveBeenCalledWith(
				"[Admin] Failed to load admin metrics:",
				dbError,
			)

			consoleSpy.mockRestore()
		})

		it("does not log when queries succeed", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			await loadAdmin()

			expect(consoleSpy).not.toHaveBeenCalled()

			consoleSpy.mockRestore()
		})

		it("returns fallback even when cronMonitor.getAllStats throws", async () => {
			// getAllStats is called outside Promise.all but inside the try block
			mockGetAllStats.mockImplementation(() => {
				throw new Error("monitor broken")
			})

			const result = await loadAdmin()

			expect(result.cronStats).toEqual({})
		})

		it("fallback secretCounts has correct shape", async () => {
			mockGetSecretStatusCounts.mockRejectedValue(new Error("fail"))

			const result = await loadAdmin()

			expect(result.secretCounts).toHaveProperty("active", 0)
			expect(result.secretCounts).toHaveProperty("paused", 0)
			expect(result.secretCounts).toHaveProperty("triggered", 0)
			expect(result.secretCounts).toHaveProperty("failed", 0)
			expect(result.secretCounts).toHaveProperty("total", 0)
		})

		it("fallback userCounts has correct shape", async () => {
			mockGetUserCounts.mockRejectedValue(new Error("fail"))

			const result = await loadAdmin()

			expect(result.userCounts).toHaveProperty("total", 0)
			expect(result.userCounts).toHaveProperty("withActiveSecrets", 0)
			expect(result.userCounts).toHaveProperty("proUsers", 0)
		})

		it("fallback emailStats has correct shape", async () => {
			mockGetEmailDeliveryStats.mockRejectedValue(new Error("fail"))

			const result = await loadAdmin()

			expect(result.emailStats).toHaveProperty("sent", 0)
			expect(result.emailStats).toHaveProperty("failed", 0)
			expect(result.emailStats).toHaveProperty("pending", 0)
			expect(result.emailStats).toHaveProperty("sentLast24h", 0)
			expect(result.emailStats).toHaveProperty("failedLast24h", 0)
		})
	})
})
