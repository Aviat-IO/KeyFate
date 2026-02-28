import type { RequestEvent } from "@sveltejs/kit"
import type { NextRequest } from "$lib/compat/next-server"

/**
 * Adapts a SvelteKit RequestEvent to the NextRequest compat type
 * used by cron auth utilities during the migration period.
 *
 * TODO: Remove once cron/utils.ts is migrated to accept standard Request + URL.
 */
export function adaptRequestEvent(event: RequestEvent): NextRequest {
  const req = event.request as NextRequest
  req.nextUrl = event.url
  return req
}
