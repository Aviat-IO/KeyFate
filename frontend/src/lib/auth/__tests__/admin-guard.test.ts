import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Session } from "@auth/core/types"

const mockRedirect = vi.fn()
const mockError = vi.fn()

vi.mock("@sveltejs/kit", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
  error: (...args: unknown[]) => mockError(...args),
}))

import { requireAdmin } from "../admin-guard"

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRedirect.mockImplementation(() => {
      throw new Error("REDIRECT")
    })
    mockError.mockImplementation(() => {
      throw new Error("ERROR")
    })
  })

  it("redirects to sign-in when session is null", () => {
    expect(() => requireAdmin(null)).toThrow("REDIRECT")
    expect(mockRedirect).toHaveBeenCalledWith(303, "/sign-in")
  })

  it("redirects to sign-in when session is undefined", () => {
    expect(() => requireAdmin(undefined as unknown as null)).toThrow("REDIRECT")
    expect(mockRedirect).toHaveBeenCalledWith(303, "/sign-in")
  })

  it("redirects to sign-in when session.user is undefined", () => {
    const session = { expires: "2099-01-01" } as Session
    expect(() => requireAdmin(session)).toThrow("REDIRECT")
    expect(mockRedirect).toHaveBeenCalledWith(303, "/sign-in")
  })

  it("redirects to sign-in when session.user is null", () => {
    const session = { expires: "2099-01-01", user: null } as unknown as Session
    expect(() => requireAdmin(session)).toThrow("REDIRECT")
    expect(mockRedirect).toHaveBeenCalledWith(303, "/sign-in")
  })

  it("throws 403 when user exists but isAdmin is false", () => {
    const session = {
      expires: "2099-01-01",
      user: { id: "u1", email: "a@b.com", isAdmin: false },
    } as unknown as Session

    expect(() => requireAdmin(session)).toThrow("ERROR")
    expect(mockError).toHaveBeenCalledWith(403, "Forbidden")
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it("throws 403 when user exists but isAdmin is not set", () => {
    const session = {
      expires: "2099-01-01",
      user: { id: "u1", email: "a@b.com" },
    } as unknown as Session

    expect(() => requireAdmin(session)).toThrow("ERROR")
    expect(mockError).toHaveBeenCalledWith(403, "Forbidden")
  })

  it("does not throw when user is admin", () => {
    const session = {
      expires: "2099-01-01",
      user: { id: "u1", email: "a@b.com", isAdmin: true },
    } as unknown as Session

    expect(() => requireAdmin(session)).not.toThrow()
    expect(mockRedirect).not.toHaveBeenCalled()
    expect(mockError).not.toHaveBeenCalled()
  })

  it("narrows session type to AdminSession after successful call", () => {
    const session = {
      expires: "2099-01-01",
      user: { id: "u1", email: "a@b.com", isAdmin: true },
    } as unknown as Session

    requireAdmin(session)

    // After the assertion function succeeds, TypeScript narrows the type.
    // Verify the narrowed properties are accessible and correct.
    expect(session.user!.id).toBe("u1")
    expect((session.user as any).isAdmin).toBe(true)
  })
})
