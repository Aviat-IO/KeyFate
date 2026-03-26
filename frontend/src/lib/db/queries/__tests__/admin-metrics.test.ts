import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Fluent chain mock — every method returns `chain`, and the chain is thenable
// so `await db.select(...).from(...).groupBy(...)` resolves to `resolvedValue`.
// ---------------------------------------------------------------------------
let resolvedValue: unknown = []

function createChainMock() {
	const chain: Record<string, ReturnType<typeof vi.fn>> & {
		then: (resolve: (v: unknown) => void) => void
	} = {} as any
	const methods = [
		"select",
		"from",
		"where",
		"groupBy",
		"innerJoin",
		"orderBy",
		"limit",
	]
	for (const m of methods) {
		chain[m] = vi.fn(() => chain)
	}
	// Make the chain thenable so `await chain` resolves to the test-controlled value
	chain.then = (resolve: (v: unknown) => void) => resolve(resolvedValue)
	return chain
}

let mockChain = createChainMock()
const mockDb = {
	select: mockChain.select,
}

vi.mock("$lib/db/drizzle", () => ({
	getDatabase: vi.fn(async () => mockDb),
}))

vi.mock("$lib/db/schema", () => ({
	secrets: {
		id: "secrets.id",
		userId: "secrets.userId",
		title: "secrets.title",
		status: "secrets.status",
		lastError: "secrets.lastError",
		updatedAt: "secrets.updatedAt",
		retryCount: "secrets.retryCount",
	},
	users: {
		id: "users.id",
		email: "users.email",
	},
	disclosureLog: {
		status: "disclosureLog.status",
		createdAt: "disclosureLog.createdAt",
	},
	emailFailures: {
		createdAt: "emailFailures.createdAt",
		resolvedAt: "emailFailures.resolvedAt",
	},
	userSubscriptions: {
		tierId: "userSubscriptions.tierId",
		status: "userSubscriptions.status",
	},
	subscriptionTiers: {
		id: "subscriptionTiers.id",
		name: "subscriptionTiers.name",
	},
	checkinHistory: {
		id: "checkinHistory.id",
		secretId: "checkinHistory.secretId",
		userId: "checkinHistory.userId",
		checkedInAt: "checkinHistory.checkedInAt",
		nextCheckIn: "checkinHistory.nextCheckIn",
		createdAt: "checkinHistory.createdAt",
	},
}))

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
	and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
	desc: vi.fn((col: unknown) => ({ type: "desc", col })),
	isNull: vi.fn((col: unknown) => ({ type: "isNull", col })),
	inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
	sql: Object.assign(
		(strings: TemplateStringsArray, ...values: unknown[]) => ({
			type: "sql",
			strings,
			values,
		}),
		{ raw: vi.fn() },
	),
}))

import {
	getSecretStatusCounts,
	getUserCounts,
	getEmailDeliveryStats,
	getFailedSecrets,
	getRecentEmailFailures,
	getRecentActivity,
} from "../admin-metrics"

describe("admin-metrics", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockChain = createChainMock()
		mockDb.select = mockChain.select
		resolvedValue = []
	})

	// -----------------------------------------------------------------------
	// getSecretStatusCounts
	// -----------------------------------------------------------------------
	describe("getSecretStatusCounts", () => {
		it("returns zeroed counts when no rows", async () => {
			resolvedValue = []

			const result = await getSecretStatusCounts()

			expect(result).toEqual({
				active: 0,
				paused: 0,
				triggered: 0,
				failed: 0,
				total: 0,
			})
		})

		it("aggregates counts correctly from grouped rows", async () => {
			resolvedValue = [
				{ status: "active", count: 10 },
				{ status: "paused", count: 3 },
				{ status: "triggered", count: 2 },
				{ status: "failed", count: 1 },
			]

			const result = await getSecretStatusCounts()

			expect(result).toEqual({
				active: 10,
				paused: 3,
				triggered: 2,
				failed: 1,
				total: 16,
			})
		})

		it("counts total as sum of all statuses including unknown ones", async () => {
			resolvedValue = [
				{ status: "active", count: 5 },
				{ status: "some_unknown_status", count: 7 },
			]

			const result = await getSecretStatusCounts()

			// "some_unknown_status" is not in counts keys, so it won't set a named field
			// but total still accumulates every row
			expect(result.active).toBe(5)
			expect(result.total).toBe(12)
		})

		it("handles string count values (SQL returns strings)", async () => {
			resolvedValue = [{ status: "active", count: "42" }]

			const result = await getSecretStatusCounts()

			expect(result.active).toBe(42)
			expect(result.total).toBe(42)
		})

		it("calls select → from → groupBy chain", async () => {
			resolvedValue = []

			await getSecretStatusCounts()

			expect(mockChain.select).toHaveBeenCalledTimes(1)
			expect(mockChain.from).toHaveBeenCalledTimes(1)
			expect(mockChain.groupBy).toHaveBeenCalledTimes(1)
		})
	})

	// -----------------------------------------------------------------------
	// getUserCounts
	// -----------------------------------------------------------------------
	describe("getUserCounts", () => {
		it("returns all zeros when tables are empty", async () => {
			// Each of the 3 parallel queries resolves to [{ count: 0 }]
			resolvedValue = [{ count: 0 }]

			const result = await getUserCounts()

			expect(result).toEqual({
				total: 0,
				withActiveSecrets: 0,
				proUsers: 0,
			})
		})

		it("returns correct counts from parallel queries", async () => {
			// All three queries share the same chain mock, so they all resolve
			// to the same value. We set it to a representative count.
			resolvedValue = [{ count: 15 }]

			const result = await getUserCounts()

			expect(result).toEqual({
				total: 15,
				withActiveSecrets: 15,
				proUsers: 15,
			})
		})

		it("handles missing count gracefully (undefined row)", async () => {
			resolvedValue = []

			const result = await getUserCounts()

			expect(result).toEqual({
				total: 0,
				withActiveSecrets: 0,
				proUsers: 0,
			})
		})

		it("runs three select calls for Promise.all", async () => {
			resolvedValue = [{ count: 0 }]

			await getUserCounts()

			// 3 parallel queries = 3 select calls
			expect(mockChain.select).toHaveBeenCalledTimes(3)
		})
	})

	// -----------------------------------------------------------------------
	// getEmailDeliveryStats
	// -----------------------------------------------------------------------
	describe("getEmailDeliveryStats", () => {
		it("returns all zeros when no disclosure log entries", async () => {
			resolvedValue = []

			const result = await getEmailDeliveryStats()

			expect(result).toEqual({
				sent: 0,
				failed: 0,
				pending: 0,
				sentLast24h: 0,
				failedLast24h: 0,
			})
		})

		it("returns correct stats when row exists", async () => {
			resolvedValue = [
				{
					sent: 100,
					failed: 5,
					pending: 12,
					sentLast24h: 20,
					failedLast24h: 2,
				},
			]

			const result = await getEmailDeliveryStats()

			expect(result).toEqual({
				sent: 100,
				failed: 5,
				pending: 12,
				sentLast24h: 20,
				failedLast24h: 2,
			})
		})

		it("coerces string values to numbers", async () => {
			resolvedValue = [
				{
					sent: "50",
					failed: "3",
					pending: "7",
					sentLast24h: "10",
					failedLast24h: "1",
				},
			]

			const result = await getEmailDeliveryStats()

			expect(result.sent).toBe(50)
			expect(result.failed).toBe(3)
			expect(result.pending).toBe(7)
			expect(result.sentLast24h).toBe(10)
			expect(result.failedLast24h).toBe(1)
		})

		it("handles null fields gracefully", async () => {
			resolvedValue = [
				{
					sent: null,
					failed: null,
					pending: null,
					sentLast24h: null,
					failedLast24h: null,
				},
			]

			const result = await getEmailDeliveryStats()

			expect(result).toEqual({
				sent: 0,
				failed: 0,
				pending: 0,
				sentLast24h: 0,
				failedLast24h: 0,
			})
		})
	})

	// -----------------------------------------------------------------------
	// getFailedSecrets
	// -----------------------------------------------------------------------
	describe("getFailedSecrets", () => {
		it("returns empty array when no failed secrets", async () => {
			resolvedValue = []

			const result = await getFailedSecrets()

			expect(result).toEqual([])
		})

		it("returns array of failed secret metadata", async () => {
			const now = new Date()
			resolvedValue = [
				{
					id: "s1",
					title: "My Secret",
					ownerEmail: "user@test.com",
					lastError: "timeout",
					updatedAt: now,
					retryCount: 3,
				},
			]

			const result = await getFailedSecrets()

			expect(result).toEqual([
				{
					id: "s1",
					title: "My Secret",
					ownerEmail: "user@test.com",
					lastError: "timeout",
					updatedAt: now,
					retryCount: 3,
				},
			])
		})

		it("uses default limit of 20", async () => {
			resolvedValue = []

			await getFailedSecrets()

			expect(mockChain.limit).toHaveBeenCalledWith(20)
		})

		it("respects custom limit parameter", async () => {
			resolvedValue = []

			await getFailedSecrets(5)

			expect(mockChain.limit).toHaveBeenCalledWith(5)
		})

		it("calls full chain: select → from → innerJoin → where → orderBy → limit", async () => {
			resolvedValue = []

			await getFailedSecrets()

			expect(mockChain.select).toHaveBeenCalledTimes(1)
			expect(mockChain.from).toHaveBeenCalledTimes(1)
			expect(mockChain.innerJoin).toHaveBeenCalledTimes(1)
			expect(mockChain.where).toHaveBeenCalledTimes(1)
			expect(mockChain.orderBy).toHaveBeenCalledTimes(1)
			expect(mockChain.limit).toHaveBeenCalledTimes(1)
		})
	})

	// -----------------------------------------------------------------------
	// getRecentEmailFailures
	// -----------------------------------------------------------------------
	describe("getRecentEmailFailures", () => {
		it("returns empty array when no unresolved failures", async () => {
			resolvedValue = []

			const result = await getRecentEmailFailures()

			expect(result).toEqual([])
		})

		it("returns unresolved email failure records", async () => {
			const now = new Date()
			resolvedValue = [
				{
					id: "ef1",
					emailType: "disclosure",
					provider: "sendgrid",
					recipient: "fail@test.com",
					subject: "Your secret",
					errorMessage: "bounced",
					retryCount: 2,
					createdAt: now,
					resolvedAt: null,
				},
			]

			const result = await getRecentEmailFailures()

			expect(result).toHaveLength(1)
			expect(result[0].id).toBe("ef1")
		})

		it("uses default limit of 20", async () => {
			resolvedValue = []

			await getRecentEmailFailures()

			expect(mockChain.limit).toHaveBeenCalledWith(20)
		})

		it("respects custom limit parameter", async () => {
			resolvedValue = []

			await getRecentEmailFailures(10)

			expect(mockChain.limit).toHaveBeenCalledWith(10)
		})

		it("filters by resolvedAt is null", async () => {
			const { isNull } = await import("drizzle-orm")
			resolvedValue = []

			await getRecentEmailFailures()

			expect(isNull).toHaveBeenCalled()
			expect(mockChain.where).toHaveBeenCalledTimes(1)
		})
	})

	// -----------------------------------------------------------------------
	// getRecentActivity
	// -----------------------------------------------------------------------
	describe("getRecentActivity", () => {
		it("returns empty array when no activity", async () => {
			resolvedValue = []

			const result = await getRecentActivity()

			expect(result).toEqual([])
		})

		it("returns checkin history with user email", async () => {
			const now = new Date()
			const next = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
			resolvedValue = [
				{
					id: "ch1",
					secretId: "s1",
					userId: "u1",
					userEmail: "user@test.com",
					checkedInAt: now,
					nextCheckIn: next,
					createdAt: now,
				},
			]

			const result = await getRecentActivity()

			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				id: "ch1",
				secretId: "s1",
				userId: "u1",
				userEmail: "user@test.com",
				checkedInAt: now,
				nextCheckIn: next,
				createdAt: now,
			})
		})

		it("uses default limit of 20", async () => {
			resolvedValue = []

			await getRecentActivity()

			expect(mockChain.limit).toHaveBeenCalledWith(20)
		})

		it("respects custom limit parameter", async () => {
			resolvedValue = []

			await getRecentActivity(50)

			expect(mockChain.limit).toHaveBeenCalledWith(50)
		})

		it("calls full chain: select → from → innerJoin → orderBy → limit", async () => {
			resolvedValue = []

			await getRecentActivity()

			expect(mockChain.select).toHaveBeenCalledTimes(1)
			expect(mockChain.from).toHaveBeenCalledTimes(1)
			expect(mockChain.innerJoin).toHaveBeenCalledTimes(1)
			expect(mockChain.orderBy).toHaveBeenCalledTimes(1)
			expect(mockChain.limit).toHaveBeenCalledTimes(1)
		})
	})
})
