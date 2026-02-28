/**
 * Compatibility shim for next-auth types
 *
 * TODO: Remove this shim when auth is fully migrated to SvelteKit's
 * auth solution (Section 3). This exists so that copied library code
 * compiles during the migration period.
 */

export interface Session {
  user?: {
    id?: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
  expires: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getServerSession(..._args: any[]): Promise<Session | null> {
  // Placeholder — will be replaced with SvelteKit auth in Section 3
  return null
}

// Re-export for next-auth/react compatibility
export async function getSession(): Promise<Session | null> {
  return null
}

export async function signIn(_provider?: string, _options?: Record<string, unknown>): Promise<void> {
  // Placeholder
}

export async function signOut(_options?: Record<string, unknown>): Promise<void> {
  // Placeholder
}
