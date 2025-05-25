import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getTheme,
  setTheme,
  type Theme,
  updateTheme,
} from "@/lib/theme-config";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock window.matchMedia
const matchMediaMock = vi.fn();

describe("Theme Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });

    // Mock matchMedia
    Object.defineProperty(window, "matchMedia", {
      value: matchMediaMock,
      writable: true,
    });

    // Mock document.documentElement
    Object.defineProperty(document, "documentElement", {
      value: {
        classList: {
          toggle: vi.fn(),
        },
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getTheme", () => {
    it("should return 'system' when window is undefined (SSR)", () => {
      // Mock window as undefined
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      const theme = getTheme();
      expect(theme).toBe("system");

      // Restore window
      global.window = originalWindow;
    });

    it("should return stored theme from localStorage", () => {
      localStorageMock.getItem.mockReturnValue("dark");

      const theme = getTheme();
      expect(theme).toBe("dark");
      expect(localStorageMock.getItem).toHaveBeenCalledWith("theme");
    });

    it("should return 'system' when no theme is stored", () => {
      localStorageMock.getItem.mockReturnValue(null);

      const theme = getTheme();
      expect(theme).toBe("system");
    });

    it("should handle invalid theme values", () => {
      localStorageMock.getItem.mockReturnValue("invalid-theme");

      const theme = getTheme();
      expect(theme).toBe("invalid-theme"); // Function doesn't validate, just returns
    });
  });

  describe("setTheme", () => {
    beforeEach(() => {
      matchMediaMock.mockReturnValue({ matches: false });
    });

    it("should store theme in localStorage and update theme", () => {
      // Mock localStorage to return the theme we're setting
      localStorageMock.getItem.mockReturnValue("dark");

      setTheme("dark");

      expect(localStorageMock.setItem).toHaveBeenCalledWith("theme", "dark");
      expect(document.documentElement.classList.toggle).toHaveBeenCalledWith(
        "dark",
        true,
      );
    });

    it("should handle all valid theme values", () => {
      const themes: Theme[] = ["dark", "light", "system"];

      themes.forEach((theme) => {
        setTheme(theme);
        expect(localStorageMock.setItem).toHaveBeenCalledWith("theme", theme);
      });
    });
  });

  describe("updateTheme", () => {
    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue("system");
    });

    it("should add dark class when theme is dark", () => {
      localStorageMock.getItem.mockReturnValue("dark");

      updateTheme();

      expect(document.documentElement.classList.toggle).toHaveBeenCalledWith(
        "dark",
        true,
      );
    });

    it("should remove dark class when theme is light", () => {
      localStorageMock.getItem.mockReturnValue("light");

      updateTheme();

      expect(document.documentElement.classList.toggle).toHaveBeenCalledWith(
        "dark",
        false,
      );
    });

    it("should use system preference when theme is system and prefers dark", () => {
      localStorageMock.getItem.mockReturnValue("system");
      matchMediaMock.mockReturnValue({ matches: true });

      updateTheme();

      expect(window.matchMedia).toHaveBeenCalledWith(
        "(prefers-color-scheme: dark)",
      );
      expect(document.documentElement.classList.toggle).toHaveBeenCalledWith(
        "dark",
        true,
      );
    });

    it("should use system preference when theme is system and prefers light", () => {
      localStorageMock.getItem.mockReturnValue("system");
      matchMediaMock.mockReturnValue({ matches: false });

      updateTheme();

      expect(window.matchMedia).toHaveBeenCalledWith(
        "(prefers-color-scheme: dark)",
      );
      expect(document.documentElement.classList.toggle).toHaveBeenCalledWith(
        "dark",
        false,
      );
    });
  });
});
