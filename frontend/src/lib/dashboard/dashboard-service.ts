/**
 * Dashboard Service with Timeout and Error Handling
 *
 * This service wraps dashboard operations with timeout protection
 * and error boundaries to prevent hanging issues.
 */

import { authConfig } from "@/lib/auth-config";
import { secretsService } from "@/lib/db/drizzle";
import { mapDrizzleSecretToApiShape } from "@/lib/db/secret-mapper";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";

export class DashboardTimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`Dashboard operation '${operation}' timed out after ${timeoutMs}ms`);
    this.name = "DashboardTimeoutError";
  }
}

/**
 * Wraps a promise with a timeout to prevent hanging operations
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new DashboardTimeoutError(operation, timeoutMs)),
        timeoutMs,
      )
    ),
  ]);
}

/**
 * Session cache to prevent multiple getServerSession calls with promise deduplication
 */
class SessionCache {
  private cache: { session: Session | null; timestamp: number } | null = null;
  private readonly TTL = 5000; // 5 seconds cache
  private pendingPromise: Promise<Session | null> | null = null;

  async getSession(): Promise<Session | null> {
    const now = Date.now();

    // Return cached session if valid
    if (this.cache && (now - this.cache.timestamp) < this.TTL) {
      console.log("[DashboardService] Using cached session");
      return this.cache.session;
    }

    // If there's already a pending request, return that promise
    if (this.pendingPromise) {
      console.log("[DashboardService] Reusing pending session request");
      return this.pendingPromise;
    }

    console.log("[DashboardService] Fetching fresh session");

    try {
      // Create and store the pending promise
      type GetServerSessionOptions = Parameters<typeof getServerSession>[0];
      this.pendingPromise = withTimeout(
        getServerSession(authConfig as GetServerSessionOptions) as Promise<
          Session | null
        >,
        3000, // 3 second timeout
        "getServerSession",
      );

      const session = await this.pendingPromise;

      // Cache the session
      this.cache = { session, timestamp: now };
      return session;
    } catch (error) {
      console.error("[DashboardService] Session fetch failed:", error);

      // Clear cache on error
      this.cache = null;

      if (error instanceof DashboardTimeoutError) {
        throw error;
      }

      throw new Error("Failed to retrieve session");
    } finally {
      // Clear the pending promise
      this.pendingPromise = null;
    }
  }

  clearCache(): void {
    this.cache = null;
    this.pendingPromise = null;
  }
}

const sessionCache = new SessionCache();

/**
 * Dashboard service with timeout protection and error handling
 */
export class DashboardService {
  /**
   * Get authenticated session with timeout protection
   */
  static async getSession(): Promise<Session | null> {
    return sessionCache.getSession();
  }

  /**
   * Get user secrets with timeout protection
   */
  static async getUserSecrets(userId: string) {
    console.log("[DashboardService] Fetching secrets for user:", userId);

    try {
      const secrets = await withTimeout(
        secretsService.getAllByUser(userId),
        5000, // 5 second timeout
        "secretsService.getAllByUser",
      );

      const mapped = (secrets || []).map(mapDrizzleSecretToApiShape);
      console.log(
        "[DashboardService] Successfully fetched",
        mapped.length,
        "secrets",
      );
      return mapped;
    } catch (error) {
      console.error("[DashboardService] Secrets fetch failed:", error);

      if (error instanceof DashboardTimeoutError) {
        throw error;
      }

      throw new Error("Failed to load secrets");
    }
  }

  /**
   * Complete dashboard data loading with comprehensive error handling
   */
  static async loadDashboardData() {
    console.log("[DashboardService] Starting dashboard data load");

    try {
      // Get session with timeout
      const session = await this.getSession();

      if (!session?.user?.id) {
        console.log("[DashboardService] No valid session found");
        return {
          success: false,
          error: "NO_SESSION",
          message: "Please sign in to continue",
        };
      }

      console.log(
        "[DashboardService] Valid session found for user:",
        session.user.id,
      );

      // Get secrets with timeout
      const secrets = await this.getUserSecrets(session.user.id);

      console.log("[DashboardService] Dashboard data loaded successfully");
      return {
        success: true,
        data: {
          user: session.user,
          secrets: secrets || [],
        },
      };
    } catch (error) {
      console.error("[DashboardService] Dashboard data load failed:", error);

      if (error instanceof DashboardTimeoutError) {
        return {
          success: false,
          error: "TIMEOUT",
          message: `Operation timed out: ${error.message}`,
        };
      }

      return {
        success: false,
        error: "UNKNOWN",
        message: "An unexpected error occurred while loading dashboard data",
      };
    }
  }

  /**
   * Clear all caches (useful for testing and error recovery)
   */
  static clearCaches(): void {
    sessionCache.clearCache();
  }
}

/**
 * React Suspense-compatible wrapper that prevents hanging
 */
export class SuspenseProtectedPromise<T> {
  private promise: Promise<T>;
  private status: "pending" | "fulfilled" | "rejected" = "pending";
  private result: T | undefined;
  private error: Error | undefined;

  constructor(promise: Promise<T>, timeoutMs: number = 10000) {
    // Wrap the original promise with timeout
    this.promise = withTimeout(promise, timeoutMs, "SuspenseProtectedPromise")
      .then((result) => {
        this.status = "fulfilled";
        this.result = result;
        return result;
      })
      .catch((error) => {
        this.status = "rejected";
        this.error = error;
        throw error;
      });
  }

  read(): T {
    if (this.status === "pending") {
      throw this.promise; // Suspense will catch this
    } else if (this.status === "rejected") {
      throw this.error;
    } else {
      return this.result as T;
    }
  }
}

/**
 * Create a Suspense-protected dashboard data loader
 */
export function createDashboardDataLoader(timeoutMs: number = 8000) {
  return new SuspenseProtectedPromise(
    DashboardService.loadDashboardData(),
    timeoutMs,
  );
}

export default DashboardService;
