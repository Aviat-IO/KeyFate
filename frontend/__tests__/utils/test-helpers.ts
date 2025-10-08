/**
 * Shared test helper utilities for consistent test patterns
 */
import { screen, within } from "@testing-library/react";

/**
 * Query selector helper that handles multiple elements by returning the first match
 * Use this when you know the text is not unique but want the first occurrence
 */
export function getFirstByText(text: string | RegExp) {
  const elements = screen.queryAllByText(text);
  if (elements.length === 0) {
    throw new Error(`Unable to find element with text: ${text}`);
  }
  return elements[0];
}

/**
 * Query selector helper for finding elements by text within a container
 * Useful for scoped queries within specific components
 */
export function getByTextInContainer(container: HTMLElement, text: string | RegExp) {
  return within(container).getByText(text);
}

/**
 * Helper to get all elements matching text and return a specific index
 */
export function getByTextAtIndex(text: string | RegExp, index: number = 0) {
  const elements = screen.queryAllByText(text);
  if (elements.length <= index) {
    throw new Error(`Found ${elements.length} elements with text "${text}", but requested index ${index}`);
  }
  return elements[index];
}

/**
 * Helper to find button by role and name (more specific than text queries)
 */
export function getButtonByName(name: string | RegExp) {
  return screen.getByRole("button", { name });
}

/**
 * Helper to find all buttons by role and return specific index
 */
export function getButtonAtIndex(name: string | RegExp, index: number = 0) {
  const buttons = screen.queryAllByRole("button", { name });
  if (buttons.length <= index) {
    throw new Error(`Found ${buttons.length} buttons with name "${name}", but requested index ${index}`);
  }
  return buttons[index];
}

/**
 * Helper to wait for text to appear (with better error messages)
 */
export async function waitForText(text: string | RegExp, options?: { timeout?: number }) {
  return screen.findByText(text, undefined, options);
}

/**
 * Helper to check if text exists without throwing
 */
export function hasText(text: string | RegExp): boolean {
  return screen.queryByText(text) !== null;
}

/**
 * Helper to get element by test ID with better error handling
 */
export function getByTestId(testId: string) {
  const element = screen.queryByTestId(testId);
  if (!element) {
    throw new Error(`Unable to find element with data-testid="${testId}"`);
  }
  return element;
}

/**
 * Helper to wait for element to be removed
 */
export async function waitForRemoval(text: string | RegExp) {
  const element = screen.queryByText(text);
  if (element) {
    await screen.findByText(text, undefined, { timeout: 100 });
  }
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
};
