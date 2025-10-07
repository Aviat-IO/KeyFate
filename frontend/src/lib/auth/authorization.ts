/**
 * Application-Level Authorization Module
 *
 * Replaces removed Supabase Row Level Security (RLS) policies with
 * application-level authorization to prevent unauthorized data access.
 *
 * This module provides:
 * - User session extraction from NextAuth
 * - Secret ownership validation
 * - Resource access validation
 * - Higher-order function for route protection
 * - Security event logging
 */

import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth-config';
import { getDatabase } from '@/lib/db/drizzle';
import { secrets, checkInTokens } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';

/**
 * User information extracted from session
 */
export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Extract authenticated user from NextAuth session
 *
 * @returns User object with id and email, or null if not authenticated
 */
export async function getUserFromSession(): Promise<AuthUser | null> {
  try {
    type GetServerSessionOptions = Parameters<typeof getServerSession>[0];
    const session = await getServerSession(authConfig as GetServerSessionOptions) as Session | null;

    if (!session?.user?.id || !session?.user?.email) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email
    };
  } catch (error) {
    console.error('[Authorization] Error getting session:', error);
    return null;
  }
}

/**
 * Validate that a user owns a specific secret
 *
 * @param secretId - The secret ID to validate ownership for
 * @param userId - The user ID to check ownership against
 * @returns true if user owns the secret, false otherwise
 */
export async function validateSecretOwnership(
  secretId: string,
  userId: string
): Promise<boolean> {
  try {
    const db = await getDatabase();

    const result = await db
      .select()
      .from(secrets)
      .where(
        and(
          eq(secrets.id, secretId),
          eq(secrets.userId, userId)
        )
      );

    return result.length > 0;
  } catch (error) {
    console.error('[Authorization] Error validating secret ownership:', error);
    return false;
  }
}

/**
 * Validate that a user has access to a specific resource
 * (e.g., check-in token, email failure record)
 *
 * @param resourceId - The resource ID (e.g., token ID)
 * @param userId - The user ID to check access for
 * @returns true if user has access, false otherwise
 */
export async function validateUserAccess(
  resourceId: string,
  userId: string
): Promise<boolean> {
  try {
    const db = await getDatabase();

    // Validate check-in token access by joining with secrets table
    const result = await db
      .select()
      .from(checkInTokens)
      .innerJoin(secrets, eq(checkInTokens.secretId, secrets.id))
      .where(
        and(
          eq(checkInTokens.id, resourceId),
          eq(secrets.userId, userId)
        )
      );

    return result.length > 0;
  } catch (error) {
    console.error('[Authorization] Error validating user access:', error);
    return false;
  }
}

/**
 * Authorization options for withAuthorization HOF
 */
export interface AuthorizationOptions {
  /**
   * Whether to validate resource ownership
   */
  validateOwnership?: boolean;

  /**
   * The parameter name containing the resource ID
   */
  resourceIdParam?: string;

  /**
   * Whether to require admin role
   */
  requireAdmin?: boolean;
}

/**
 * Higher-order function to wrap API route handlers with authorization
 *
 * @param handler - The API route handler function
 * @param options - Authorization options
 * @returns Wrapped handler with authorization checks
 *
 * @example
 * ```typescript
 * const handler = withAuthorization(
 *   async (request, params, user) => {
 *     // Handler code with guaranteed authenticated user
 *     return NextResponse.json({ success: true });
 *   },
 *   {
 *     validateOwnership: true,
 *     resourceIdParam: 'secretId'
 *   }
 * );
 * ```
 */
export function withAuthorization<TParams = any, TResult = any>(
  handler: (
    request: Request,
    params: TParams,
    user: AuthUser
  ) => Promise<TResult>,
  options: AuthorizationOptions = {}
): (request: Request, params: TParams) => Promise<TResult | NextResponse> {
  return async (request: Request, params: TParams): Promise<TResult | NextResponse> => {
    // Step 1: Check authentication
    const user = await getUserFromSession();

    if (!user) {
      console.warn('[Authorization] Unauthenticated access attempt', {
        path: request.url,
        timestamp: new Date().toISOString()
      });

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ) as any;
    }

    // Step 2: Check resource ownership if required
    if (options.validateOwnership && options.resourceIdParam) {
      const resourceId = (params as any)[options.resourceIdParam];

      if (!resourceId) {
        console.error('[Authorization] Missing resource ID parameter', {
          param: options.resourceIdParam,
          params
        });

        return NextResponse.json(
          { error: 'Bad Request: Missing resource ID' },
          { status: 400 }
        ) as any;
      }

      const isOwner = await validateSecretOwnership(resourceId, user.id);

      if (!isOwner) {
        console.warn('[Authorization] Unauthorized access attempt', {
          userId: user.id,
          email: user.email,
          resourceId,
          path: request.url,
          timestamp: new Date().toISOString()
        });

        return NextResponse.json(
          { error: 'Forbidden: Access denied' },
          { status: 403 }
        ) as any;
      }
    }

    // Step 3: Execute the handler with authenticated user
    try {
      return await handler(request, params, user);
    } catch (error) {
      console.error('[Authorization] Handler execution error:', error);
      throw error;
    }
  };
}

/**
 * Validate admin role for admin-only operations
 *
 * @param userId - The user ID to check admin status for
 * @returns true if user is admin, false otherwise
 *
 * Note: Implementation depends on how admin role is stored in the database.
 * Currently returns false as admin role system is not yet implemented.
 */
export async function validateAdminRole(userId: string): Promise<boolean> {
  // TODO: Implement admin role validation once admin system is in place
  // This would check a is_super_admin or role column in the users table
  console.warn('[Authorization] Admin role validation not yet implemented');
  return false;
}

/**
 * Log security event for monitoring and audit purposes
 *
 * @param event - The security event type
 * @param details - Event details
 */
export function logSecurityEvent(
  event: 'unauthorized_access' | 'forbidden_access' | 'admin_access',
  details: Record<string, any>
): void {
  console.warn(`[Security Event] ${event}`, {
    ...details,
    timestamp: new Date().toISOString()
  });

  // TODO: Send to monitoring service (e.g., Sentry, DataDog)
  // TODO: Store in audit log table for compliance
}
