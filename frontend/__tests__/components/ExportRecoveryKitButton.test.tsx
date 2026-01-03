import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ExportRecoveryKitButton } from "@/components/ExportRecoveryKitButton"

// Mock the export-recovery-kit module
vi.mock("@/lib/export-recovery-kit", () => ({
  downloadRecoveryKit: vi.fn().mockResolvedValue(undefined),
  getUserManagedSharesFromStorage: vi.fn().mockReturnValue(["share1", "share2"]),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock useCSRF hook
vi.mock("@/hooks/useCSRF", () => ({
  useCSRF: () => ({
    fetchWithCSRF: mockFetch,
  }),
}))

describe("ExportRecoveryKitButton", () => {
  const mockSecret = {
    id: "test-secret-123",
    title: "Test Secret",
    checkInDays: 7,
    createdAt: new Date("2024-01-01"),
    recipients: [
      { id: "r1", name: "Alice", email: "alice@example.com", phone: null },
      { id: "r2", name: "Bob", email: "bob@example.com", phone: null },
    ],
  }

  const defaultProps = {
    secret: mockSecret,
    threshold: 2,
    totalShares: 3,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  it("should render the export button", () => {
    render(<ExportRecoveryKitButton {...defaultProps} />)

    expect(screen.getByRole("button", { name: /export recovery kit/i })).toBeInTheDocument()
  })

  it("should open dialog when button is clicked", async () => {
    render(<ExportRecoveryKitButton {...defaultProps} />)

    const button = screen.getByRole("button", { name: /export recovery kit/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText(/download a complete backup/i)).toBeInTheDocument()
    })
  })

  it("should display security notice in dialog", async () => {
    render(<ExportRecoveryKitButton {...defaultProps} />)

    const button = screen.getByRole("button", { name: /export recovery kit/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText(/security notice/i)).toBeInTheDocument()
      expect(screen.getByText(/store this file securely/i)).toBeInTheDocument()
    })
  })

  it("should list what the kit includes", async () => {
    render(<ExportRecoveryKitButton {...defaultProps} />)

    const button = screen.getByRole("button", { name: /export recovery kit/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText(/standalone recovery tool/i)).toBeInTheDocument()
      expect(screen.getByText(/server share/i)).toBeInTheDocument()
      expect(screen.getByText(/user-managed shares/i)).toBeInTheDocument()
    })
  })

  it("should show loading state during export", async () => {
    // Make fetch hang to test loading state
    mockFetch.mockImplementation(() => new Promise(() => {}))

    render(<ExportRecoveryKitButton {...defaultProps} />)

    const button = screen.getByRole("button", { name: /export recovery kit/i })
    fireEvent.click(button)

    // Click the download button in the dialog
    const downloadButton = await screen.findByRole("button", { name: /download kit/i })
    fireEvent.click(downloadButton)

    await waitFor(() => {
      expect(screen.getByText(/exporting/i)).toBeInTheDocument()
    })
  })

  it("should call API and download kit on export", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          serverShare: "decrypted-share-123",
        }),
    })

    const { downloadRecoveryKit } = await import("@/lib/export-recovery-kit")

    render(<ExportRecoveryKitButton {...defaultProps} />)

    const button = screen.getByRole("button", { name: /export recovery kit/i })
    fireEvent.click(button)

    const downloadButton = await screen.findByRole("button", { name: /download kit/i })
    fireEvent.click(downloadButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/secrets/${mockSecret.id}/export-share`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      )
    })

    await waitFor(() => {
      expect(downloadRecoveryKit).toHaveBeenCalled()
    })
  })

  it("should show error message on API failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Server error" }),
    })

    render(<ExportRecoveryKitButton {...defaultProps} />)

    const button = screen.getByRole("button", { name: /export recovery kit/i })
    fireEvent.click(button)

    const downloadButton = await screen.findByRole("button", { name: /download kit/i })
    fireEvent.click(downloadButton)

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    })
  })

  it("should show specific error for 401 unauthorized", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    })

    render(<ExportRecoveryKitButton {...defaultProps} />)

    const button = screen.getByRole("button", { name: /export recovery kit/i })
    fireEvent.click(button)

    const downloadButton = await screen.findByRole("button", { name: /download kit/i })
    fireEvent.click(downloadButton)

    await waitFor(() => {
      expect(screen.getByText(/session expired/i)).toBeInTheDocument()
    })
  })

  it("should show specific error for 404 not found", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    })

    render(<ExportRecoveryKitButton {...defaultProps} />)

    const button = screen.getByRole("button", { name: /export recovery kit/i })
    fireEvent.click(button)

    const downloadButton = await screen.findByRole("button", { name: /download kit/i })
    fireEvent.click(downloadButton)

    await waitFor(() => {
      expect(screen.getByText(/server share not found/i)).toBeInTheDocument()
    })
  })

  it("should show success message after export", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          serverShare: "decrypted-share",
        }),
    })

    render(<ExportRecoveryKitButton {...defaultProps} />)

    const button = screen.getByRole("button", { name: /export recovery kit/i })
    fireEvent.click(button)

    const downloadButton = await screen.findByRole("button", { name: /download kit/i })
    fireEvent.click(downloadButton)

    await waitFor(() => {
      expect(screen.getByText(/downloaded successfully/i)).toBeInTheDocument()
    })
  })

  it("should close dialog when cancel is clicked", async () => {
    render(<ExportRecoveryKitButton {...defaultProps} />)

    const button = screen.getByRole("button", { name: /export recovery kit/i })
    fireEvent.click(button)

    const cancelButton = await screen.findByRole("button", { name: /cancel/i })
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.queryByText(/download a complete backup/i)).not.toBeInTheDocument()
    })
  })

  it("should apply custom className", () => {
    render(<ExportRecoveryKitButton {...defaultProps} className="custom-class" />)

    const button = screen.getByRole("button", { name: /export recovery kit/i })
    expect(button).toHaveClass("custom-class")
  })
})
