import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import ShareInstructionsPage from "@/app/(authenticated)/secrets/[id]/share-instructions/page"

// Mock Next.js navigation
const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => {
    const params = new Map([
      ["secretId", "test-secret-123"],
      ["sss_shares_total", "3"],
      ["sss_threshold", "2"],
      ["recipient_name", "John Doe"],
      ["recipient_email", "john@example.com"],
    ])
    return {
      get: (key: string) => params.get(key) || null,
    }
  },
}))

// Mock clipboard API
const mockWriteText = vi.fn(() => Promise.resolve())
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
})

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
})

describe("ShareInstructions - Clipboard Copy", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()

    // Setup valid shares in localStorage
    const shares = {
      shares: ["share1hex", "share2hex", "share3hex"],
      expiresAt: Date.now() + 7200000, // 2 hours from now
    }
    localStorageMock.setItem(
      "keyfate:userManagedShares:test-secret-123",
      JSON.stringify(shares)
    )
  })

  it("should copy first share to clipboard successfully", async () => {
    render(<ShareInstructionsPage />)

    await waitFor(() => {
      expect(screen.getByText(/Share #1/)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Find and click the first copy button
    const copyButtons = screen.getAllByLabelText(/Copy/)
    fireEvent.click(copyButtons[0])

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("share1hex")
      expect(screen.getAllByText(/Copied to clipboard!/)[0]).toBeInTheDocument()
    })
  })

  it("should copy second share to clipboard successfully", async () => {
    render(<ShareInstructionsPage />)

    await waitFor(() => {
      expect(screen.getByText(/Primary Recipient's/)).toBeInTheDocument()
    })

    // Find and click the second copy button
    const copyButtons = screen.getAllByLabelText(/Copy/)
    fireEvent.click(copyButtons[1])

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("share2hex")
    })
  })

  it("should handle sequential clipboard copies correctly", async () => {
    render(<ShareInstructionsPage />)

    await waitFor(() => {
      expect(screen.getByText(/Your Personal Share/)).toBeInTheDocument()
    })

    const copyButtons = screen.getAllByLabelText(/Copy/)

    // Copy first share
    fireEvent.click(copyButtons[0])
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenNthCalledWith(1, "share1hex")
    })

    // Copy second share immediately after
    fireEvent.click(copyButtons[1])
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenNthCalledWith(2, "share2hex")
    })

    // Verify both calls completed successfully
    expect(mockWriteText).toHaveBeenCalledTimes(2)
  })

  it("should show independent visual feedback for each share copy", async () => {
    render(<ShareInstructionsPage />)

    await waitFor(() => {
      expect(screen.getByText(/Your Personal Share/)).toBeInTheDocument()
    })

    const copyButtons = screen.getAllByLabelText(/Copy/)

    // Copy first share and verify its feedback
    fireEvent.click(copyButtons[0])

    await waitFor(() => {
      const feedbackMessages = screen.getAllByText(/Copied to clipboard!/)
      expect(feedbackMessages.length).toBeGreaterThanOrEqual(1)
    })

    // Copy second share
    fireEvent.click(copyButtons[1])

    await waitFor(() => {
      // Should have feedback for second copy
      expect(screen.getAllByText(/Copied to clipboard!/).length).toBeGreaterThanOrEqual(1)
    })
  })

  it("should reset visual feedback after timeout", async () => {
    vi.useFakeTimers()

    render(<ShareInstructionsPage />)

    await waitFor(() => {
      expect(screen.getByText(/Your Personal Share/)).toBeInTheDocument()
    })

    const copyButtons = screen.getAllByLabelText(/Copy/)

    // Copy first share
    fireEvent.click(copyButtons[0])

    await waitFor(() => {
      expect(screen.getAllByText(/Copied to clipboard!/)[0]).toBeInTheDocument()
    })

    // Fast-forward 2 seconds
    vi.advanceTimersByTime(2000)

    await waitFor(() => {
      expect(screen.queryAllByText(/Copied to clipboard!/)).toHaveLength(0)
    })

    vi.useRealTimers()
  })

  it("should handle rapid sequential copies without interference", async () => {
    render(<ShareInstructionsPage />)

    await waitFor(() => {
      expect(screen.getByText(/Your Personal Share/)).toBeInTheDocument()
    })

    const copyButtons = screen.getAllByLabelText(/Copy/)

    // Rapid clicks
    fireEvent.click(copyButtons[0])
    fireEvent.click(copyButtons[1])
    fireEvent.click(copyButtons[0])

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(3)
    })

    // Verify the last call has the correct share
    expect(mockWriteText).toHaveBeenLastCalledWith("share1hex")
  })

  it("should handle clipboard API errors gracefully", async () => {
    // Mock a clipboard error
    mockWriteText.mockRejectedValueOnce(new Error("Clipboard access denied"))

    render(<ShareInstructionsPage />)

    await waitFor(() => {
      expect(screen.getByText(/Your Personal Share/)).toBeInTheDocument()
    })

    const copyButtons = screen.getAllByLabelText(/Copy/)

    // This should not crash the app
    fireEvent.click(copyButtons[0])

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalled()
    })

    // The error should be handled (no visual feedback shown on error)
    expect(screen.queryByText(/Copied to clipboard!/)).not.toBeInTheDocument()
  })

  it("should display correct share count for 3-share scenario", async () => {
    render(<ShareInstructionsPage />)

    await waitFor(() => {
      expect(screen.getByText(/Your Personal Share/)).toBeInTheDocument()
      expect(screen.getByText(/Primary Recipient's/)).toBeInTheDocument()
      expect(screen.getByText(/Additional Distributable Share/)).toBeInTheDocument()
    })

    const copyButtons = screen.getAllByLabelText(/Copy/)
    expect(copyButtons).toHaveLength(3)
  })
})
