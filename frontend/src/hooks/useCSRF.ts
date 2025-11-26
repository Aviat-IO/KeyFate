"use client"

import { useCallback } from "react"

interface CSRFTokenResponse {
  token: string
  expiresIn: number
}

/**
 * Hook to handle CSRF-protected API calls.
 * Fetches a fresh CSRF token before each request to ensure validity.
 */
export function useCSRF() {
  const fetchWithCSRF = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      // Fetch a fresh CSRF token
      const csrfResponse = await fetch("/api/csrf-token")
      if (!csrfResponse.ok) {
        throw new Error("Failed to obtain CSRF token")
      }

      const { token }: CSRFTokenResponse = await csrfResponse.json()

      // Merge headers, adding CSRF token
      const headers = new Headers(options.headers)
      headers.set("x-csrf-token", token)

      return fetch(url, {
        ...options,
        headers,
      })
    },
    [],
  )

  return { fetchWithCSRF }
}
