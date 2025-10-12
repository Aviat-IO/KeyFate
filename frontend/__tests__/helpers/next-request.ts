import { NextRequest } from "next/server"

/**
 * Convert a standard Request to a NextRequest for testing
 * NextRequest includes additional properties that Next.js adds
 */
export function createNextRequest(
  input: string | Request | URL,
  init?: RequestInit,
): NextRequest {
  // Create the basic request
  const request = input instanceof Request ? input : new Request(input, init)

  // Create NextRequest with the same properties
  const nextRequest = new NextRequest(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    // Cast to any to bypass TypeScript restrictions for testing
    ...(init as any),
  })

  return nextRequest
}

/**
 * Helper to create a NextRequest for API testing
 */
export function createApiRequest(
  url: string,
  options: RequestInit = {},
): NextRequest {
  return createNextRequest(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  })
}
