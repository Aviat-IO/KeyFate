import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  useContactMethods,
  type ContactMethods,
} from "@/hooks/useContactMethods"

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    upsert: vi.fn(),
  })),
}

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createClientComponentClient: () => mockSupabase,
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
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        user_id: "user-123",
        email: "test@example.com",
        phone: "+1234567890",
        telegram_username: "@testuser",
        whatsapp: "+0987654321",
        signal: "+1122334455",
        preferred_method: "email",
        check_in_days: 30,
      },
      error: null,
    })

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      upsert: vi.fn(),
    })

    const { result } = renderHook(() => useContactMethods())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockSupabase.auth.getUser).toHaveBeenCalled()
    expect(mockSupabase.from).toHaveBeenCalledWith("user_contact_methods")
    expect(mockSelect).toHaveBeenCalledWith("*")
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-123")
    expect(mockSingle).toHaveBeenCalled()

    expect(result.current.contactMethods).toEqual(mockContactMethods)
    expect(result.current.error).toBeNull()
  })

  it("should handle user not found", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
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

  it("should handle no existing contact methods (PGRST116 error)", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows found" },
    })

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
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

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("Database error"),
    })

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      upsert: vi.fn(),
    })

    const { result } = renderHook(() => useContactMethods())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe("Database error")
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error loading contact methods:",
      expect.any(Error),
    )

    consoleSpy.mockRestore()
  })

  it("should save contact methods successfully", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    // Mock initial load (no existing methods)
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116" },
    })

    const mockUpsert = vi.fn().mockResolvedValue({
      error: null,
    })

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      upsert: mockUpsert,
    })

    const { result } = renderHook(() => useContactMethods())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Test saving
    await result.current.saveContactMethods(mockContactMethods)

    expect(mockUpsert).toHaveBeenCalledWith({
      user_id: "user-123",
      ...mockContactMethods,
    })
  })

  it("should throw error when saving without authentication", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const { result } = renderHook(() => useContactMethods())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await expect(
      result.current.saveContactMethods(mockContactMethods),
    ).rejects.toThrow("Not authenticated")
  })

  it("should throw error when saving without any contact methods", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116" },
    })

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      upsert: vi.fn(),
    })

    const { result } = renderHook(() => useContactMethods())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const emptyMethods: ContactMethods = {
      email: "",
      phone: "",
      telegram_username: "",
      whatsapp: "",
      signal: "",
      preferred_method: "email",
      check_in_days: 90,
    }

    await expect(
      result.current.saveContactMethods(emptyMethods),
    ).rejects.toThrow("At least one contact method is required")
  })
})
