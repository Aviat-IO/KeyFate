import * as encryption from "@/lib/encryption"
import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NewSecretForm } from "./newSecretForm"
// Mock encryptMessage to return predictable values
vi.spyOn(encryption, "encryptMessage").mockImplementation(async (msg) => ({
  encrypted: `enc-${msg}`,
  iv: "iv-mock",
  authTag: "authTag-mock",
}))

// @ts-expect-error - fetch is not defined in the global scope
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ secretId: "test-id" }),
  }),
)

describe("NewSecretForm", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it("creates SSS shares, stores them in localStorage, and redirects", async () => {
    render(<NewSecretForm />)
    fireEvent.change(screen.getByLabelText(/Secret Title/i), {
      target: { value: "Test Secret" },
    })
    fireEvent.change(screen.getByLabelText(/Secret Message/i), {
      target: { value: "supersecret" },
    })
    fireEvent.change(screen.getByLabelText(/Recipient's Name/i), {
      target: { value: "Alice" },
    })
    fireEvent.change(screen.getByLabelText(/Recipient's Email/i), {
      target: { value: "alice@example.com" },
    })
    fireEvent.change(screen.getByLabelText(/Total Shares to Create/i), {
      target: { value: 3 },
    })
    fireEvent.change(screen.getByLabelText(/Shares Needed for Recovery/i), {
      target: { value: 2 },
    })
    fireEvent.click(screen.getByRole("button", { name: /Create Secret/i }))

    await waitFor(() => {
      expect(
        localStorage.getItem("keyfate:userManagedShares:test-id"),
      ).toBeTruthy()
    })
    const stored = JSON.parse(
      localStorage.getItem("keyfate:userManagedShares:test-id")!,
    )
    expect(Array.isArray(stored.shares)).toBe(true)
    expect(typeof stored.expiresAt).toBe("number")
    expect(stored.shares.length).toBe(2) // 3 shares, 1 for server, 2 for user/recipient
  })

  it("shows validation error if threshold > shares", async () => {
    render(<NewSecretForm />)
    fireEvent.change(screen.getByLabelText(/Total Shares to Create/i), {
      target: { value: 2 },
    })
    fireEvent.change(screen.getByLabelText(/Shares Needed for Recovery/i), {
      target: { value: 3 },
    })
    fireEvent.click(screen.getByRole("button", { name: /Create Secret/i }))
    expect(
      await screen.findByText(
        /Threshold must be less than or equal to total shares/i,
      ),
    ).toBeInTheDocument()
  })

  it("shows validation error for missing required fields", async () => {
    render(<NewSecretForm />)
    fireEvent.click(screen.getByRole("button", { name: /Create Secret/i }))
    expect(await screen.findByText(/Title is required/i)).toBeInTheDocument()
    expect(
      await screen.findByText(/Secret message is required/i),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Recipient name is required/i),
    ).toBeInTheDocument()
  })
})
