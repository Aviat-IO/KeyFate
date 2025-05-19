import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { beforeEach } from "node:test"
import { describe, expect, it, vi } from "vitest"
import ShareInstructionsPage from "./page"

function setupLocalStorage(
  secretId: string,
  shares: string[],
  expiresAt: number,
) {
  localStorage.setItem(
    `keyfate:userManagedShares:${secretId}`,
    JSON.stringify({ shares, expiresAt }),
  )
}

describe("ShareInstructionsPage", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks?.()
    window.history.pushState(
      {},
      "",
      "/secrets/test-id/share-instructions?secretId=test-id&sss_shares_total=3&sss_threshold=2&recipient_name=Alice&recipient_email=alice@example.com",
    )
  })

  it("loads and displays shares from localStorage if not expired", async () => {
    setupLocalStorage("test-id", ["share2", "share3"], Date.now() + 10000)
    render(<ShareInstructionsPage />)
    expect(
      await screen.findByText(/Share 2: Your Personal Share/i),
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue("share2")).toBeInTheDocument()
    expect(screen.getByText(/Primary Recipient's/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue("share3")).toBeInTheDocument()
  })

  it("shows error if shares are missing from localStorage", async () => {
    render(<ShareInstructionsPage />)
    expect(
      await screen.findByText(/could not find your shares/i),
    ).toBeInTheDocument()
  })

  it("shows error if shares are expired and removes them", async () => {
    setupLocalStorage("test-id", ["share2", "share3"], Date.now() - 10000)
    render(<ShareInstructionsPage />)
    expect(
      await screen.findByText(/your shares have expired/i),
    ).toBeInTheDocument()
    expect(localStorage.getItem("keyfate:userManagedShares:test-id")).toBeNull()
  })

  it("shows error if shares are malformed", async () => {
    localStorage.setItem("keyfate:userManagedShares:test-id", "not-json")
    render(<ShareInstructionsPage />)
    expect(
      await screen.findByText(/failed to parse your shares/i),
    ).toBeInTheDocument()
  })

  it("shows error if share count does not match", async () => {
    setupLocalStorage("test-id", ["share2"], Date.now() + 10000) // should be 2 shares for 3 total
    render(<ShareInstructionsPage />)
    expect(await screen.findByText(/share count mismatch/i)).toBeInTheDocument()
  })
})
