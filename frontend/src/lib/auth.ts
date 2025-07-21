import { createClient } from "@/utils/supabase/client";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at?: string;
  expires_in?: string;
  token_type?: string;
  type?: string;
}

/**
 * Parse authentication tokens from URL fragment
 * @param hash - URL hash fragment (e.g., "#access_token=...&refresh_token=...")
 * @returns Parsed tokens or null if invalid
 */
export function parseTokensFromHash(hash: string): AuthTokens | null {
  if (!hash || !hash.includes("access_token=")) {
    return null;
  }

  try {
    // Remove the leading # and parse as URLSearchParams
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresAt = params.get("expires_at");
    const expiresIn = params.get("expires_in");
    const tokenType = params.get("token_type");
    const type = params.get("type");

    if (!accessToken || !refreshToken) {
      return null;
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt || undefined,
      expires_in: expiresIn || undefined,
      token_type: tokenType || undefined,
      type: type || undefined,
    };
  } catch (error) {
    console.error("[Auth] Error parsing tokens from hash:", error);
    return null;
  }
}

/**
 * Establish Supabase session from authentication tokens
 * @param tokens - Authentication tokens
 * @returns Promise that resolves to session data or error
 */
export async function establishSessionFromTokens(
  tokens: AuthTokens,
): Promise<{ data: unknown; error: unknown }> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });

    if (error) {
      console.error("[Auth] Error setting session:", error);
      return { data: null, error };
    }

    console.log("[Auth] Session set successfully:", data);
    return { data, error: null };
  } catch (error) {
    console.error("[Auth] Exception setting session:", error);
    return { data: null, error };
  }
}

/**
 * Clear authentication tokens from URL hash
 * This removes the hash fragment from the URL without triggering a page reload
 */
export function clearTokensFromUrl(): void {
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", window.location.pathname);
  }
}

/**
 * Complete authentication flow by parsing tokens and establishing session
 * @param hash - URL hash fragment containing tokens
 * @returns Promise that resolves to success status and session data
 */
export async function completeAuthFlow(hash: string): Promise<{
  success: boolean;
  data?: unknown;
  error?: unknown;
}> {
  const tokens = parseTokensFromHash(hash);

  if (!tokens) {
    return {
      success: false,
      error: "Invalid authentication link",
    };
  }

  const { data, error } = await establishSessionFromTokens(tokens);

  if (error) {
    return {
      success: false,
      error: "Failed to establish session",
    };
  }

  // Clear tokens from URL for security
  clearTokensFromUrl();

  return {
    success: true,
    data,
  };
}

/**
 * Check if the current URL contains authentication tokens
 * @returns True if tokens are present in URL hash
 */
export function hasAuthTokensInUrl(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.hash.includes("access_token=");
}
