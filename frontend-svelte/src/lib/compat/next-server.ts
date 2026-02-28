/**
 * Compatibility shim for next/server types
 *
 * TODO: Remove this shim when files are fully migrated to SvelteKit's
 * RequestEvent pattern. This exists so that copied library code compiles
 * during the migration period.
 */

export type NextRequest = Request & {
  nextUrl: URL
  cookies: {
    get(name: string): { value: string } | undefined
    set(name: string, value: string): void
    delete(name: string): void
  }
  headers: Headers
  ip?: string
  geo?: {
    city?: string
    country?: string
    region?: string
  }
}

export class NextResponse extends Response {
  static json(body: unknown, init?: ResponseInit): NextResponse {
    return new Response(JSON.stringify(body), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    }) as NextResponse
  }

  static redirect(url: string | URL, status?: number): NextResponse {
    return Response.redirect(url, status) as NextResponse
  }
}
