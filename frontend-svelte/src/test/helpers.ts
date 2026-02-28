/**
 * Shared test helper utilities for SvelteKit tests
 *
 * Ported from frontend/__tests__/utils/test-helpers.ts
 * Adapted for Svelte Testing Library instead of React Testing Library.
 */
import { screen, within } from "@testing-library/svelte"

/**
 * Query selector helper that handles multiple elements by returning the first match
 */
export function getFirstByText(text: string | RegExp) {
  const elements = screen.queryAllByText(text)
  if (elements.length === 0) {
    throw new Error(`Unable to find element with text: ${text}`)
  }
  return elements[0]
}

/**
 * Query selector helper for finding elements by text within a container
 */
export function getByTextInContainer(
  container: HTMLElement,
  text: string | RegExp,
) {
  return within(container).getByText(text)
}

/**
 * Helper to get all elements matching text and return a specific index
 */
export function getByTextAtIndex(text: string | RegExp, index: number = 0) {
  const elements = screen.queryAllByText(text)
  if (elements.length <= index) {
    throw new Error(
      `Found ${elements.length} elements with text "${text}", but requested index ${index}`,
    )
  }
  return elements[index]
}

/**
 * Helper to find button by role and name
 */
export function getButtonByName(name: string | RegExp) {
  return screen.getByRole("button", { name })
}

/**
 * Helper to find all buttons by role and return specific index
 */
export function getButtonAtIndex(name: string | RegExp, index: number = 0) {
  const buttons = screen.queryAllByRole("button", { name })
  if (buttons.length <= index) {
    throw new Error(
      `Found ${buttons.length} buttons with name "${name}", but requested index ${index}`,
    )
  }
  return buttons[index]
}

/**
 * Helper to wait for text to appear
 */
export async function waitForText(
  text: string | RegExp,
  options?: { timeout?: number },
) {
  return screen.findByText(text, undefined, options)
}

/**
 * Helper to check if text exists without throwing
 */
export function hasText(text: string | RegExp): boolean {
  return screen.queryByText(text) !== null
}

/**
 * Helper to get element by test ID
 */
export function getByTestId(testId: string) {
  const element = screen.queryByTestId(testId)
  if (!element) {
    throw new Error(`Unable to find element with data-testid="${testId}"`)
  }
  return element
}

/**
 * Helper for accessibility-focused queries
 */
export const a11y = {
  getHeading: (name: string | RegExp) => screen.getByRole("heading", { name }),
  getButton: (name: string | RegExp) => screen.getByRole("button", { name }),
  getLink: (name: string | RegExp) => screen.getByRole("link", { name }),
  getTextbox: (name: string | RegExp) => screen.getByRole("textbox", { name }),
  getAlert: () => screen.getByRole("alert"),
  getStatus: () => screen.getByRole("status"),
}

/**
 * Create a mock SvelteKit RequestEvent for testing API routes
 */
export function createMockRequestEvent(
  overrides: {
    method?: string
    url?: string
    headers?: Record<string, string>
    body?: unknown
    params?: Record<string, string>
    locals?: Record<string, unknown>
  } = {},
) {
  const url = new URL(overrides.url || "http://localhost:5173/api/test")
  const headers = new Headers(overrides.headers || {})

  const request = new Request(url.toString(), {
    method: overrides.method || "GET",
    headers,
    ...(overrides.body
      ? { body: JSON.stringify(overrides.body) }
      : {}),
  })

  return {
    request,
    url,
    params: overrides.params || {},
    locals: overrides.locals || {
      auth: async () => null,
    },
    cookies: {
      get: () => undefined,
      getAll: () => [],
      set: () => {},
      delete: () => {},
      serialize: () => "",
    },
    fetch: globalThis.fetch,
    getClientAddress: () => "127.0.0.1",
    platform: {},
    route: { id: null },
    isDataRequest: false,
    isSubRequest: false,
  }
}
