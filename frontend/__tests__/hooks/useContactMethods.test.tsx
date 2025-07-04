import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  useContactMethods,
  type ContactMethods,
} from "@/hooks/useContactMethods"

// Mock Supabase client using vi.hoisted to ensure proper initialization order
const { mockAuth, mockFrom, mockSupabaseClient } = vi.hoisted(() => {
  const mockAuth = {
    getUser: vi.fn(),
  }

  const mockFrom = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn(),
  }))

  const mockSupabaseClient = {
    auth: mockAuth,
    from: mockFrom,
  }

  return { mockAuth, mockFrom, mockSupabaseClient }
})

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createClientComponentClient: () => mockSupabaseClient,
}))

describe("useContactMethods", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
  }

  const mockContactMethods: ContactMethods = {
    email: "test@example.com",
    phone: "+1234567890",
    telegram_username: "@testuser",
    whatsapp: "+0987654321",
    signal: "+1122334455",
    preferred_method: "email",
    check_in_days: 30,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should load contact methods for authenticated user", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        user_id: "user-123",
        email: "test@example.com",
        phone: "+1234567890",
        preferred_method: "email",
      },
      error: null,
    })

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn(),
    })

    const { result } = renderHook(() => useContactMethods())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockAuth.getUser).toHaveBeenCalled()
    expect(mockFrom).toHaveBeenCalledWith("user_contact_methods")
    expect(mockSelect).toHaveBeenCalledWith("*")
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-123")
    expect(mockMaybeSingle).toHaveBeenCalled()

    expect(result.current.contactMethods).toEqual({
      user_id: "user-123",
      email: "test@example.com",
      phone: "+1234567890",
      preferred_method: "email",
    })
    expect(result.current.error).toBeNull()
  })

  it("should handle user not found", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const { result } = renderHook(() => useContactMethods())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.contactMethods).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it("should handle no existing contact methods", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn(),
    })

    const { result } = renderHook(() => useContactMethods())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.contactMethods).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it("should handle database errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    mockAuth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("Database error"),
    })

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn(),
    })

    const { result } = renderHook(() => useContactMethods())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe("Database error")
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error fetching contact methods:",
      expect.any(Error),
    )

    consoleSpy.mockRestore()
  })

  it("should save contact methods successfully", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    // Mock initial load (no existing methods)
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })

    const mockUpsert = vi.fn().mockResolvedValue({
      error: null,
    })

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
      upsert: mockUpsert,
    })

    const { result } = renderHook(() => useContactMethods())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Test saving
    await result.current.saveContactMethods({
      email: "test@example.com",
      phone: "+1234567890",
      preferred_method: "email",
    })

    expect(mockUpsert).toHaveBeenCalledWith({
      user_id: "user-123",
      email: "test@example.com",
      phone: "+1234567890",
      preferred_method: "email",
    })
  })

  it("should handle save errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    mockAuth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    // Mock initial load
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })

    const mockUpsert = vi.fn().mockResolvedValue({
      error: new Error("Save failed"),
    })

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
      upsert: mockUpsert,
    })

    const { result } = renderHook(() => useContactMethods())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Test saving with error
    await expect(
      result.current.saveContactMethods({
        email: "test@example.com",
        phone: "+1234567890",
        preferred_method: "email",
      }),
    ).rejects.toThrow("Save failed")

    consoleSpy.mockRestore()
  })
})
