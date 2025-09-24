/**
 * Rate limiting service for email verification operations
 * Implements in-memory rate limiting with configurable limits per operation type
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: Date;
}

// In-memory storage for rate limits (in production, use Redis or similar)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit configurations for different operations
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  'verify-email': {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  'resend-verification': {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
};

/**
 * Get rate limit configuration for an operation
 */
export function getRateLimitConfig(operation: string): RateLimitConfig {
  const config = RATE_LIMIT_CONFIGS[operation];
  if (!config) {
    throw new Error(`Unknown rate limit operation: ${operation}`);
  }
  return config;
}

/**
 * Generate rate limit key
 */
function getRateLimitKey(operation: string, identifier: string): string {
  const normalizedIdentifier = identifier.toLowerCase().trim();
  return `${operation}:${normalizedIdentifier}`;
}

/**
 * Check if request is within rate limit
 */
export async function checkRateLimit(
  operation: string,
  identifier: string
): Promise<RateLimitResult> {
  const config = getRateLimitConfig(operation);
  const key = getRateLimitKey(operation, identifier);
  const now = new Date();

  // Get current rate limit entry
  let entry = rateLimitStore.get(key);

  // If no entry exists or it's expired, create new one
  if (!entry || now >= entry.resetTime) {
    entry = {
      count: 0,
      resetTime: new Date(now.getTime() + config.windowMs),
    };
    rateLimitStore.set(key, entry);
  }

  // Check if limit exceeded
  if (entry.count >= config.maxAttempts) {
    const retryAfter = Math.ceil((entry.resetTime.getTime() - now.getTime()) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxAttempts - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Clear rate limit for testing purposes
 */
export async function clearRateLimit(operation: string, identifier: string): Promise<void> {
  const key = getRateLimitKey(operation, identifier);
  rateLimitStore.delete(key);
}

/**
 * Cleanup expired rate limit entries (should be called periodically)
 */
export function cleanupExpiredRateLimits(): number {
  const now = new Date();
  let deletedCount = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetTime) {
      rateLimitStore.delete(key);
      deletedCount++;
    }
  }

  return deletedCount;
}