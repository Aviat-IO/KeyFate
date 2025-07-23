import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { ThemeToggle } from "@/components/theme-toggle"

// Mock next-themes
const mockSetTheme = vi.fn()
const mockUseTheme = vi.fn()

vi.mock("next-themes", () => ({
  useTheme: () => mockUseTheme(),
}))

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTheme.mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
    })
  })

  it("should render theme toggle button", () => {
    render(<ThemeToggle />)

    const button = screen.getByRole("button")
    expect(button).toBeInTheDocument()
    expect(screen.getByText("Toggle theme")).toBeInTheDocument()
  })

  it("should render sun and moon icons", () => {
    render(<ThemeToggle />)

    const button = screen.getByRole("button")

    // Check for SVG elements (icons) - should render one icon at a time
    const svgElements = button.querySelectorAll("svg")
    expect(svgElements).toHaveLength(1) // Only one icon is rendered at a time
  })

  it("should toggle from light to dark theme", () => {
    mockUseTheme.mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
    })

    render(<ThemeToggle />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    expect(mockSetTheme).toHaveBeenCalledWith("dark")
  })

  it("should toggle from dark to light theme", () => {
    mockUseTheme.mockReturnValue({
      theme: "dark",
      setTheme: mockSetTheme,
    })

    render(<ThemeToggle />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    expect(mockSetTheme).toHaveBeenCalledWith("light")
  })

  it("should handle system theme by toggling to light", () => {
    mockUseTheme.mockReturnValue({
      theme: "system",
      setTheme: mockSetTheme,
    })

    render(<ThemeToggle />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    // When theme is not "light", it should toggle to "light"
    expect(mockSetTheme).toHaveBeenCalledWith("light")
  })

  it("should handle undefined theme by toggling to light", () => {
    mockUseTheme.mockReturnValue({
      theme: undefined,
      setTheme: mockSetTheme,
    })

    render(<ThemeToggle />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    expect(mockSetTheme).toHaveBeenCalledWith("light")
  })

  it("should be accessible with screen reader text", () => {
    render(<ThemeToggle />)

    const srText = screen.getByText("Toggle theme")
    expect(srText).toHaveClass("sr-only")
  })

  it("should have correct button styling", () => {
    render(<ThemeToggle />)

    const button = screen.getByRole("button")

    // Check for button classes (from Button component)
    expect(button).toHaveClass("inline-flex") // Base button class
  })

  it("should handle multiple clicks correctly", () => {
    // Test that each click toggles correctly based on current theme
    mockUseTheme.mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
    })

    const { unmount } = render(<ThemeToggle />)

    const button = screen.getByRole("button")

    // First click - light to dark
    fireEvent.click(button)
    expect(mockSetTheme).toHaveBeenCalledWith("dark")

    // Clean up first render
    unmount()

    // Update mock to return dark theme
    mockUseTheme.mockReturnValue({
      theme: "dark",
      setTheme: mockSetTheme,
    })

    // Re-render with new theme
    render(<ThemeToggle />)
    const buttonAfterUpdate = screen.getByRole("button")

    // Second click - dark to light
    fireEvent.click(buttonAfterUpdate)
    expect(mockSetTheme).toHaveBeenCalledWith("light")

    expect(mockSetTheme).toHaveBeenCalledTimes(2)
  })

  it("should handle edge case gracefully", () => {
    // Test that component renders even with minimal theme data
    mockUseTheme.mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
    })

    render(<ThemeToggle />)

    const button = screen.getByRole("button")
    expect(button).toBeInTheDocument()
  })
})
