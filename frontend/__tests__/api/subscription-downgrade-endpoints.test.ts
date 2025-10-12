import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/services/subscription-service", () => ({
  subscriptionService: {
    scheduleDowngrade: vi.fn(),
    cancelScheduledDowngrade: vi.fn(),
  },
}))

const mockGetServerSession = vi.mocked(getServerSession)

describe("API Endpoints - Subscription Downgrade (TDD)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("POST /api/user/subscription/schedule-downgrade", () => {
    it("should schedule downgrade for authenticated Pro user", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123", email: "test@example.com" },
      } as any)

      const { subscriptionService } = await import(
        "@/lib/services/subscription-service"
      )
      vi.mocked(subscriptionService.scheduleDowngrade).mockResolvedValue({
        id: "sub-uuid",
        userId: "user-123",
        scheduledDowngradeAt: new Date("2025-02-01"),
      } as any)

      const { POST } = await import(
        "@/app/api/user/subscription/schedule-downgrade/route"
      )

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/user/subscription/schedule-downgrade",
        {
          method: "POST",
        },
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.scheduledDowngradeAt).toBeDefined()
      expect(subscriptionService.scheduleDowngrade).toHaveBeenCalledWith(
        "user-123",
      )
    })

    it("should return 401 for unauthenticated user", async () => {
      mockGetServerSession.mockResolvedValue(null)

      const { POST } = await import(
        "@/app/api/user/subscription/schedule-downgrade/route"
      )

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/user/subscription/schedule-downgrade",
        {
          method: "POST",
        },
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe("Unauthorized")
    })

    it("should return 400 when downgrade already scheduled", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123", email: "test@example.com" },
      } as any)

      const { subscriptionService } = await import(
        "@/lib/services/subscription-service"
      )
      vi.mocked(subscriptionService.scheduleDowngrade).mockRejectedValue(
        new Error("Downgrade already scheduled"),
      )

      const { POST } = await import(
        "@/app/api/user/subscription/schedule-downgrade/route"
      )

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/user/subscription/schedule-downgrade",
        {
          method: "POST",
        },
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("Downgrade already scheduled")
    })

    it("should return 404 when user has no subscription", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-no-sub", email: "test@example.com" },
      } as any)

      const { subscriptionService } = await import(
        "@/lib/services/subscription-service"
      )
      vi.mocked(subscriptionService.scheduleDowngrade).mockRejectedValue(
        new Error("No active subscription found"),
      )

      const { POST } = await import(
        "@/app/api/user/subscription/schedule-downgrade/route"
      )

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/user/subscription/schedule-downgrade",
        {
          method: "POST",
        },
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain("No active subscription found")
    })

    it("should return 500 for unexpected errors", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123", email: "test@example.com" },
      } as any)

      const { subscriptionService } = await import(
        "@/lib/services/subscription-service"
      )
      vi.mocked(subscriptionService.scheduleDowngrade).mockRejectedValue(
        new Error("Database connection failed"),
      )

      const { POST } = await import(
        "@/app/api/user/subscription/schedule-downgrade/route"
      )

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/user/subscription/schedule-downgrade",
        {
          method: "POST",
        },
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain("Failed to schedule downgrade")
    })
  })

  describe("POST /api/user/subscription/cancel-downgrade", () => {
    it("should cancel scheduled downgrade for authenticated user", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123", email: "test@example.com" },
      } as any)

      const { subscriptionService } = await import(
        "@/lib/services/subscription-service"
      )
      vi.mocked(subscriptionService.cancelScheduledDowngrade).mockResolvedValue(
        {
          id: "sub-uuid",
          userId: "user-123",
          scheduledDowngradeAt: null,
        } as any,
      )

      const { POST } = await import(
        "@/app/api/user/subscription/cancel-downgrade/route"
      )

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/user/subscription/cancel-downgrade",
        {
          method: "POST",
        },
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(subscriptionService.cancelScheduledDowngrade).toHaveBeenCalledWith(
        "user-123",
      )
    })

    it("should return 401 for unauthenticated user", async () => {
      mockGetServerSession.mockResolvedValue(null)

      const { POST } = await import(
        "@/app/api/user/subscription/cancel-downgrade/route"
      )

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/user/subscription/cancel-downgrade",
        {
          method: "POST",
        },
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe("Unauthorized")
    })

    it("should return 400 when no downgrade is scheduled", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123", email: "test@example.com" },
      } as any)

      const { subscriptionService } = await import(
        "@/lib/services/subscription-service"
      )
      vi.mocked(subscriptionService.cancelScheduledDowngrade).mockRejectedValue(
        new Error("No scheduled downgrade found"),
      )

      const { POST } = await import(
        "@/app/api/user/subscription/cancel-downgrade/route"
      )

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/user/subscription/cancel-downgrade",
        {
          method: "POST",
        },
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("No scheduled downgrade found")
    })

    it("should return 404 when user has no subscription", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-no-sub", email: "test@example.com" },
      } as any)

      const { subscriptionService } = await import(
        "@/lib/services/subscription-service"
      )
      vi.mocked(subscriptionService.cancelScheduledDowngrade).mockRejectedValue(
        new Error("No subscription found"),
      )

      const { POST } = await import(
        "@/app/api/user/subscription/cancel-downgrade/route"
      )

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/user/subscription/cancel-downgrade",
        {
          method: "POST",
        },
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain("No subscription found")
    })
  })
})
