import DecryptPage from "@/app/decrypt/page"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock Next.js navigation
const mockUseSearchParams = vi.fn()
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
}))

// Mock the SssDecryptor component
vi.mock("@/components/sss-decryptor", () => ({
  SssDecryptor: ({ initialShares }: { initialShares?: string[] }) => (
    <div data-testid="sss-decryptor">
      <div data-testid="initial-shares">{JSON.stringify(initialShares)}</div>
    </div>
  ),
}))

// Mock NavBar and Footer
vi.mock("@/components/nav-bar", () => ({
  NavBar: () => <nav data-testid="navbar">NavBar</nav>,
}))

vi.mock("@/components/footer", () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}))

describe("DecryptPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should render with empty shares when no query params", () => {
    const mockSearchParams = {
      get: vi.fn().mockReturnValue(null),
    }
    mockUseSearchParams.mockReturnValue(mockSearchParams)

    render(<DecryptPage />)

    expect(screen.getByTestId("navbar")).toBeInTheDocument()
    expect(screen.getByTestId("footer")).toBeInTheDocument()
    expect(screen.getByTestId("sss-decryptor")).toBeInTheDocument()
    expect(screen.getByTestId("initial-shares")).toHaveTextContent("[]")
  })

  it("should extract single share from query params", () => {
    const mockSearchParams = {
      get: vi.fn((param: string) => {
        if (param === "share1") return "abc123"
        return null
      }),
    }
    mockUseSearchParams.mockReturnValue(mockSearchParams)

    render(<DecryptPage />)

    expect(screen.getByTestId("initial-shares")).toHaveTextContent('["abc123"]')
  })

  it("should extract multiple shares from query params", () => {
    const mockSearchParams = {
      get: vi.fn((param: string) => {
        if (param === "share1") return "abc123"
        if (param === "share2") return "def456"
        if (param === "share3") return "ghi789"
        return null
      }),
    }
    mockUseSearchParams.mockReturnValue(mockSearchParams)

    render(<DecryptPage />)

    expect(screen.getByTestId("initial-shares")).toHaveTextContent(
      '["abc123","def456","ghi789"]',
    )
  })

  it("should handle non-sequential share parameters", () => {
    const mockSearchParams = {
      get: vi.fn((param: string) => {
        if (param === "share1") return "abc123"
        if (param === "share2") return null // Missing share2
        if (param === "share3") return "ghi789"
        return null
      }),
    }
    mockUseSearchParams.mockReturnValue(mockSearchParams)

    render(<DecryptPage />)

    // Should only extract share1 since share2 is missing (extraction stops at first missing)
    expect(screen.getByTestId("initial-shares")).toHaveTextContent('["abc123"]')
  })

  it("should handle empty share values", () => {
    const mockSearchParams = {
      get: vi.fn((param: string) => {
        if (param === "share1") return ""
        if (param === "share2") return "def456"
        return null
      }),
    }
    mockUseSearchParams.mockReturnValue(mockSearchParams)

    render(<DecryptPage />)

    // Empty string is falsy, so extraction stops at the first empty share
    expect(screen.getByTestId("initial-shares")).toHaveTextContent("[]")
  })

  it("should render page structure correctly", () => {
    const mockSearchParams = {
      get: vi.fn().mockReturnValue(null),
    }
    mockUseSearchParams.mockReturnValue(mockSearchParams)

    const { container } = render(<DecryptPage />)

    // Check page structure
    expect(container.querySelector(".min-h-screen")).toBeInTheDocument()
    expect(container.querySelector(".sticky")).toBeInTheDocument()
    expect(container.querySelector(".backdrop-blur")).toBeInTheDocument()
    expect(container.querySelector(".mx-auto")).toBeInTheDocument()
    expect(container.querySelector(".flex")).toBeInTheDocument()
    expect(container.querySelector(".w-full")).toBeInTheDocument()
    expect(container.querySelector(".max-w-2xl")).toBeInTheDocument()
  })
})
