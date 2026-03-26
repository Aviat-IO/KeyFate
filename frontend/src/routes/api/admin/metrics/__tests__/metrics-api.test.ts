import { describe, it, expect, vi, beforeEach } from "vitest"

// --- Mocks ---

const mockRequireAdmin = vi.fn()
vi.mock("$lib/auth/admin-guard", () => ({
	requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}))

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

import { GET } from "../+server"

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
	{ id: "sec_1", title: "My Secret", ownerEmail: "user@example.com", lastError: "Timeout", updatedAt: new Date("2026-03-01"), retryCount: 3 },
]
const MOCK_EMAIL_FAILURES = [
	{ id: "ef_1", email: "bounce@example.com", errorCode: "550", createdAt: new Date("2026-03-07"), resolvedAt: null },
]
const MOCK_RECENT_ACTIVITY = [
	{ id: "ch_1", secretId: "sec_2", userId: "usr_1", userEmail: "active@example.com", checkedInAt: new Date("2026-03-08"), nextCheckIn: new Date("2026-03-15"), createdAt: new Date("2026-03-08") },
]
const MOCK_CRON_STATS = {
	"check-in-monitor": { lastRun: "2026-03-08T00:00:00Z", successCount: 42 },
}

const ADMIN_SESSION = { user: { id: "usr_admin", email: "admin@keyfate.com", isAdmin: true } }

function makeEvent(session: unknown = ADMIN_SESSION) {
	return {
		locals: {
			auth: vi.fn().mockResolvedValue(session),
		},
	} as any
}

// --- Tests ---

describe("GET /api/admin/metrics", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockRequireAdmin.mockImplementation(() => {})
		mockGetSecretStatusCounts.mockResolvedValue(MOCK_SECRET_COUNTS)
		mockGetUserCounts.mockResolvedValue(MOCK_USER_COUNTS)
		mockGetEmailDeliveryStats.mockResolvedValue(MOCK_EMAIL_STATS)
		mockGetFailedSecrets.mockResolvedValue(MOCK_FAILED_SECRETS)
		mockGetRecentEmailFailures.mockResolvedValue(MOCK_EMAIL_FAILURES)
		mockGetRecentActivity.mockResolvedValue(MOCK_RECENT_ACTIVITY)
		mockGetAllStats.mockReturnValue(MOCK_CRON_STATS)
	})

	describe("authentication", () => {
		it("calls event.locals.auth() to get session", async () => {
			const event = makeEvent()
			await GET(event)
			expect(event.locals.auth).toHaveBeenCalledOnce()
		})

		it("passes session to requireAdmin", async () => {
			const event = makeEvent()
			await GET(event)
			expect(mockRequireAdmin).toHaveBeenCalledWith(ADMIN_SESSION)
		})

		it("throws when requireAdmin rejects non-admin", async () => {
			mockRequireAdmin.mockImplementation(() => {
				throw { status: 403, body: { message: "Forbidden" } }
			})
			await expect(GET(makeEvent())).rejects.toMatchObject({ status: 403 })
		})

		it("redirects when requireAdmin rejects no session", async () => {
			mockRequireAdmin.mockImplementation(() => {
				throw { status: 303, location: "/sign-in" }
			})
			await expect(GET(makeEvent(null))).rejects.toMatchObject({ status: 303 })
		})
	})

	describe("happy path", () => {
		it("returns 200 JSON response", async () => {
			const response = await GET(makeEvent())
			expect(response.status).toBe(200)
			expect(response.headers.get("content-type")).toContain("application/json")
		})

		it("returns all metrics in response body", async () => {
			const response = await GET(makeEvent())
			const body = await response.json()

			expect(body.secretCounts).toEqual(MOCK_SECRET_COUNTS)
			expect(body.userCounts).toEqual(MOCK_USER_COUNTS)
			expect(body.emailStats).toEqual(MOCK_EMAIL_STATS)
			expect(body.failedSecrets).toHaveLength(1)
			expect(body.emailFailures).toHaveLength(1)
			expect(body.recentActivity).toHaveLength(1)
			expect(body.cronStats).toEqual(MOCK_CRON_STATS)
		})

		it("calls all six query functions", async () => {
			await GET(makeEvent())

			expect(mockGetSecretStatusCounts).toHaveBeenCalledOnce()
			expect(mockGetUserCounts).toHaveBeenCalledOnce()
			expect(mockGetEmailDeliveryStats).toHaveBeenCalledOnce()
			expect(mockGetFailedSecrets).toHaveBeenCalledOnce()
			expect(mockGetRecentEmailFailures).toHaveBeenCalledOnce()
			expect(mockGetRecentActivity).toHaveBeenCalledOnce()
		})

		it("includes cronStats from cronMonitor", async () => {
			const response = await GET(makeEvent())
			const body = await response.json()
			expect(body.cronStats).toEqual(MOCK_CRON_STATS)
			expect(mockGetAllStats).toHaveBeenCalledOnce()
		})
	})

	describe("response shape", () => {
		it("has all expected top-level keys", async () => {
			const response = await GET(makeEvent())
			const body = await response.json()

			expect(Object.keys(body).sort()).toEqual([
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
})
