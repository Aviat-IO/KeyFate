/**
 * Compatibility shim for next/headers
 *
 * TODO: Remove this shim when audit-logger and other files are migrated
 * to use SvelteKit's RequestEvent pattern for header access.
 */

export async function headers(): Promise<Headers> {
  // In SvelteKit, headers come from RequestEvent, not a global function.
  // This placeholder returns empty headers. Callers should be migrated
  // to pass headers explicitly via RequestEvent.
  return new Headers()
}

export async function cookies(): Promise<Map<string, string>> {
  return new Map()
}
