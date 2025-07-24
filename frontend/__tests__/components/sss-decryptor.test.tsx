import { SssDecryptor } from "@/components/sss-decryptor"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock shamirs-secret-sharing using vi.hoisted
const { mockCombine } = vi.hoisted(() => ({
  mockCombine: vi.fn(),
}))

vi.mock("shamirs-secret-sharing", () => ({
  default: {
    combine: mockCombine,
  },
}))

// Buffer is used normally - no need to mock it

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
})

describe("SssDecryptor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should render with default empty shares", () => {
    render(<SssDecryptor />)

    expect(screen.getByText("Secret Recovery")).toBeInTheDocument()
    expect(screen.getByText("Enter Your Shares")).toBeInTheDocument()
    expect(screen.getByText("Educational demonstration:")).toBeInTheDocument()

    // Should have 2 share inputs by default
    const shareInputs = screen.getAllByPlaceholderText(
      /Share \d+ \(hexadecimal format\)/,
    )
    expect(shareInputs).toHaveLength(2)
  })

  it("should render with initial shares", () => {
    const initialShares = ["abc123", "def456", "ghi789"]
    render(<SssDecryptor initialShares={initialShares} />)

    // Should have 3 share inputs pre-filled
    const shareInputs = screen.getAllByPlaceholderText(
      /Share \d+ \(hexadecimal format\)/,
    )
    expect(shareInputs).toHaveLength(3)
    expect(shareInputs[0]).toHaveValue("abc123")
    expect(shareInputs[1]).toHaveValue("def456")
    expect(shareInputs[2]).toHaveValue("ghi789")
  })

  it("should handle single initial share", () => {
    const initialShares = ["abc123"]
    render(<SssDecryptor initialShares={initialShares} />)

    const shareInputs = screen.getAllByPlaceholderText(
      /Share \d+ \(hexadecimal format\)/,
    )
    expect(shareInputs).toHaveLength(2) // Should still have minimum 2 inputs
    expect(shareInputs[0]).toHaveValue("abc123")
    expect(shareInputs[1]).toHaveValue("")
  })

  it("should render educational messaging", () => {
    render(<SssDecryptor />)

    expect(screen.getByText("Educational demonstration:")).toBeInTheDocument()
    expect(
      screen.getByText(/This tool runs entirely in your browser/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/For maximum security with sensitive secrets/),
    ).toBeInTheDocument()

    const localInstructionsLink = screen.getByRole("link", {
      name: /get setup instructions for local use/i,
    })
    expect(localInstructionsLink).toBeInTheDocument()
    expect(localInstructionsLink).toHaveAttribute("href", "/local-instructions")
  })

  it("should add share input when button clicked", () => {
    render(<SssDecryptor />)

    const addButton = screen.getByRole("button", { name: /add another share/i })
    fireEvent.click(addButton)

    // Should now have 3 share inputs
    const shareInputs = screen.getAllByPlaceholderText(
      /Share \d+ \(hexadecimal format\)/,
    )
    expect(shareInputs).toHaveLength(3)
  })

  it("should remove share input when delete button clicked", () => {
    render(<SssDecryptor />)

    // Add a third share first
    const addButton = screen.getByRole("button", { name: /add another share/i })
    fireEvent.click(addButton)

    // Now should have remove buttons for all shares (when > 2 shares)
    const removeButtons = screen.getAllByLabelText("Remove share")
    expect(removeButtons).toHaveLength(3) // All shares get remove buttons when > 2 shares

    fireEvent.click(removeButtons[0])

    // Should be back to 2 shares
    const shareInputs = screen.getAllByPlaceholderText(
      /Share \d+ \(hexadecimal format\)/,
    )
    expect(shareInputs).toHaveLength(2)
  })

  it("should prevent removing when only 2 shares", () => {
    render(<SssDecryptor />)

    // Should not have remove buttons with only 2 shares
    const removeButtons = screen.queryAllByLabelText("Remove share")
    expect(removeButtons).toHaveLength(0)
  })

  it("should handle successful secret recovery", async () => {
    const mockRecoveredBuffer = {
      toString: vi.fn(() => "recovered secret message"),
    }
    mockCombine.mockReturnValue(mockRecoveredBuffer)

    render(<SssDecryptor />)

    // Fill in shares
    const shareInputs = screen.getAllByPlaceholderText(
      /Share \d+ \(hexadecimal format\)/,
    )
    fireEvent.change(shareInputs[0], { target: { value: "abc123" } })
    fireEvent.change(shareInputs[1], { target: { value: "def456" } })

    // Click recover button
    const recoverButton = screen.getByRole("button", {
      name: /recover secret/i,
    })

    await act(async () => {
      fireEvent.click(recoverButton)
    })

    // Wait for success
    await waitFor(() => {
      expect(
        screen.getByText("Secret Recovered Successfully!"),
      ).toBeInTheDocument()
      expect(screen.getByText("Your original secret is:")).toBeInTheDocument()
      expect(
        screen.getByDisplayValue("recovered secret message"),
      ).toBeInTheDocument()
    })

    // Should call sss.combine with correct buffers
    expect(mockCombine).toHaveBeenCalled()
  })

  it("should handle recovery errors", async () => {
    render(<SssDecryptor />)

    // Fill in invalid shares (non-hex characters)
    const shareInputs = screen.getAllByPlaceholderText(
      /Share \d+ \(hexadecimal format\)/,
    )
    fireEvent.change(shareInputs[0], { target: { value: "invalid" } })
    fireEvent.change(shareInputs[1], { target: { value: "shares" } })

    // Click recover button
    const recoverButton = screen.getByRole("button", {
      name: /recover secret/i,
    })

    await act(async () => {
      fireEvent.click(recoverButton)
    })

    await waitFor(() => {
      expect(screen.getByText("Recovery Failed")).toBeInTheDocument()
      expect(
        screen.getByText(/Failed to recover secret: Invalid share format/),
      ).toBeInTheDocument()
    })
  })

  it("should validate hex format", async () => {
    render(<SssDecryptor />)

    // Fill in invalid hex
    const shareInputs = screen.getAllByPlaceholderText(
      /Share \d+ \(hexadecimal format\)/,
    )
    fireEvent.change(shareInputs[0], { target: { value: "not-hex!" } })
    fireEvent.change(shareInputs[1], { target: { value: "abc123" } })

    // Click recover button
    const recoverButton = screen.getByRole("button", {
      name: /recover secret/i,
    })
    fireEvent.click(recoverButton)

    await waitFor(() => {
      expect(screen.getByText(/Invalid share format/)).toBeInTheDocument()
    })
  })

  it("should require at least 2 shares", async () => {
    render(<SssDecryptor />)

    // Only fill one share
    const shareInputs = screen.getAllByPlaceholderText(
      /Share \d+ \(hexadecimal format\)/,
    )
    fireEvent.change(shareInputs[0], { target: { value: "abc123" } })

    // Check that recover button is disabled with insufficient shares
    const recoverButton = screen.getByRole("button", {
      name: /recover secret/i,
    })
    expect(recoverButton).toBeDisabled()
  })

  it("should handle copy to clipboard", async () => {
    const mockRecoveredBuffer = {
      toString: vi.fn(() => "secret to copy"),
    }
    mockCombine.mockReturnValue(mockRecoveredBuffer)

    render(<SssDecryptor />)

    // Simulate successful recovery first
    const shareInputs = screen.getAllByPlaceholderText(
      /Share \d+ \(hexadecimal format\)/,
    )
    fireEvent.change(shareInputs[0], { target: { value: "abc123" } })
    fireEvent.change(shareInputs[1], { target: { value: "def456" } })

    const recoverButton = screen.getByRole("button", {
      name: /recover secret/i,
    })
    fireEvent.click(recoverButton)

    await waitFor(() => {
      expect(
        screen.getByText("Secret Recovered Successfully!"),
      ).toBeInTheDocument()
    })

    // Click copy button
    const copyButton = screen.getByRole("button", {
      name: /copy recovered secret/i,
    })
    fireEvent.click(copyButton)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("secret to copy")
  })

  it("should clear previous results when shares change", () => {
    const mockRecoveredBuffer = {
      toString: vi.fn(() => "recovered secret"),
    }
    mockCombine.mockReturnValue(mockRecoveredBuffer)

    render(<SssDecryptor />)

    // First recovery
    const shareInputs = screen.getAllByPlaceholderText(
      /Share \d+ \(hexadecimal format\)/,
    )
    fireEvent.change(shareInputs[0], { target: { value: "abc123" } })
    fireEvent.change(shareInputs[1], { target: { value: "def456" } })

    const recoverButton = screen.getByRole("button", {
      name: /recover secret/i,
    })
    fireEvent.click(recoverButton)

    // Change a share
    fireEvent.change(shareInputs[0], { target: { value: "new123" } })

    // Previous result should be cleared
    expect(
      screen.queryByText("Secret Recovered Successfully!"),
    ).not.toBeInTheDocument()
  })

  it("should disable recover button when insufficient shares", () => {
    render(<SssDecryptor />)

    const recoverButton = screen.getByRole("button", {
      name: /recover secret/i,
    })
    expect(recoverButton).toBeDisabled()

    // Add one share
    const shareInputs = screen.getAllByPlaceholderText(
      /Share \d+ \(hexadecimal format\)/,
    )
    fireEvent.change(shareInputs[0], { target: { value: "abc123" } })

    expect(recoverButton).toBeDisabled()

    // Add second share
    fireEvent.change(shareInputs[1], { target: { value: "def456" } })

    expect(recoverButton).not.toBeDisabled()
  })
})
