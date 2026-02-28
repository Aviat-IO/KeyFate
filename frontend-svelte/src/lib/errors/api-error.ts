/**
 * Standardized API Error Handling
 *
 * Provides consistent error structure, codes, and HTTP status mapping
 * for all API endpoints.
 */

import { NextResponse } from "$lib/compat/next-server"
import { logger } from "$lib/logger"

/**
 * Standard error codes for API responses
 */
export enum ErrorCode {
  // Authentication & Authorization (401, 403)
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",

  // Validation (400)
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT = "INVALID_FORMAT",
  VALUE_OUT_OF_RANGE = "VALUE_OUT_OF_RANGE",

  // Resource Errors (404, 409, 410)
  NOT_FOUND = "NOT_FOUND",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  ALREADY_EXISTS = "ALREADY_EXISTS",
  CONFLICT = "CONFLICT",
  RESOURCE_DELETED = "RESOURCE_DELETED",

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",

  // Business Logic (422)
  BUSINESS_RULE_VIOLATION = "BUSINESS_RULE_VIOLATION",
  OPERATION_NOT_ALLOWED = "OPERATION_NOT_ALLOWED",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",

  // Server Errors (500, 502, 503, 504)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  TIMEOUT = "TIMEOUT",

  // Security (400, 403)
  CSRF_TOKEN_INVALID = "CSRF_TOKEN_INVALID",
  CSRF_TOKEN_MISSING = "CSRF_TOKEN_MISSING",
  SIGNATURE_INVALID = "SIGNATURE_INVALID",
  ENCRYPTION_ERROR = "ENCRYPTION_ERROR",
}

/**
 * Error severity levels for logging and monitoring
 */
export enum ErrorSeverity {
  LOW = "low", // User errors, validation failures
  MEDIUM = "medium", // Business logic violations, rate limits
  HIGH = "high", // Database errors, external service failures
  CRITICAL = "critical", // Security violations, data corruption
}

/**
 * Structured API error with consistent format
 */
export class APIError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly severity: ErrorSeverity
  public readonly details?: Record<string, unknown>
  public readonly isOperational: boolean
  public readonly timestamp: string

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number,
    options?: {
      severity?: ErrorSeverity
      details?: Record<string, unknown>
      cause?: Error
      isOperational?: boolean
    },
  ) {
    super(message)
    this.name = "APIError"
    this.code = code
    this.statusCode = statusCode
    this.severity = options?.severity ?? this.inferSeverity(statusCode)
    this.details = options?.details
    this.isOperational = options?.isOperational ?? true
    this.timestamp = new Date().toISOString()

    // Preserve stack trace
    if (options?.cause) {
      this.stack = options.cause.stack
    } else if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError)
    }
  }

  /**
   * Infer severity from HTTP status code
   */
  private inferSeverity(statusCode: number): ErrorSeverity {
    if (statusCode >= 500) return ErrorSeverity.HIGH
    if (statusCode === 429) return ErrorSeverity.MEDIUM
    if (statusCode === 403 || statusCode === 401) return ErrorSeverity.MEDIUM
    return ErrorSeverity.LOW
  }

  /**
   * Convert to JSON response format
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
        timestamp: this.timestamp,
      },
    }
  }

  /**
   * Static factory methods for common errors
   */

  static unauthorized(message = "Authentication required"): APIError {
    return new APIError(message, ErrorCode.UNAUTHORIZED, 401, {
      severity: ErrorSeverity.MEDIUM,
    })
  }

  static forbidden(message = "Access denied"): APIError {
    return new APIError(message, ErrorCode.FORBIDDEN, 403, {
      severity: ErrorSeverity.MEDIUM,
    })
  }

  static notFound(resource = "Resource", id?: string): APIError {
    const message = id ? `${resource} ${id} not found` : `${resource} not found`
    return new APIError(message, ErrorCode.RESOURCE_NOT_FOUND, 404, {
      severity: ErrorSeverity.LOW,
      details: { resource, id },
    })
  }

  static validation(
    message: string,
    details?: Record<string, unknown>,
  ): APIError {
    return new APIError(message, ErrorCode.VALIDATION_ERROR, 400, {
      severity: ErrorSeverity.LOW,
      details,
    })
  }

  static conflict(
    message: string,
    details?: Record<string, unknown>,
  ): APIError {
    return new APIError(message, ErrorCode.CONFLICT, 409, {
      severity: ErrorSeverity.LOW,
      details,
    })
  }

  static rateLimit(
    message = "Too many requests",
    retryAfter?: number,
  ): APIError {
    return new APIError(message, ErrorCode.RATE_LIMIT_EXCEEDED, 429, {
      severity: ErrorSeverity.MEDIUM,
      details: retryAfter ? { retryAfter } : undefined,
    })
  }

  static businessRule(
    message: string,
    details?: Record<string, unknown>,
  ): APIError {
    return new APIError(message, ErrorCode.BUSINESS_RULE_VIOLATION, 422, {
      severity: ErrorSeverity.MEDIUM,
      details,
    })
  }

  static internal(
    message = "Internal server error",
    cause?: Error,
    details?: Record<string, unknown>,
  ): APIError {
    return new APIError(message, ErrorCode.INTERNAL_ERROR, 500, {
      severity: ErrorSeverity.HIGH,
      details,
      cause,
      isOperational: false,
    })
  }

  static database(message: string, cause?: Error): APIError {
    return new APIError(message, ErrorCode.DATABASE_ERROR, 500, {
      severity: ErrorSeverity.HIGH,
      cause,
      isOperational: true,
    })
  }

  static externalService(
    service: string,
    message?: string,
    cause?: Error,
  ): APIError {
    const errorMessage =
      message ?? `External service error: ${service} is unavailable`
    return new APIError(errorMessage, ErrorCode.EXTERNAL_SERVICE_ERROR, 502, {
      severity: ErrorSeverity.HIGH,
      details: { service },
      cause,
      isOperational: true,
    })
  }

  static timeout(operation: string): APIError {
    return new APIError(
      `Operation timed out: ${operation}`,
      ErrorCode.TIMEOUT,
      504,
      {
        severity: ErrorSeverity.HIGH,
        details: { operation },
        isOperational: true,
      },
    )
  }

  static csrfInvalid(message = "CSRF token validation failed"): APIError {
    return new APIError(message, ErrorCode.CSRF_TOKEN_INVALID, 403, {
      severity: ErrorSeverity.CRITICAL,
    })
  }

  static accountLocked(lockedUntil?: Date): APIError {
    return new APIError(
      "Account temporarily locked due to failed attempts",
      ErrorCode.ACCOUNT_LOCKED,
      403,
      {
        severity: ErrorSeverity.MEDIUM,
        details: lockedUntil ? { lockedUntil: lockedUntil.toISOString() } : {},
      },
    )
  }
}

/**
 * Handle API errors consistently across all endpoints
 */
export function handleAPIError(error: unknown): NextResponse {
  // Already an APIError - use its structure
  if (error instanceof APIError) {
    logger.warn(`API error: ${error.code}`, {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      severity: error.severity,
      details: error.details,
    })

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    // Add Retry-After header for rate limit errors
    if (
      error.code === ErrorCode.RATE_LIMIT_EXCEEDED &&
      error.details?.retryAfter
    ) {
      headers["Retry-After"] = String(error.details.retryAfter)
    }

    return NextResponse.json(error.toJSON(), {
      status: error.statusCode,
      headers,
    })
  }

  // Native Error - convert to APIError
  if (error instanceof Error) {
    logger.error("Unhandled error in API", error, {
      message: error.message,
      stack: error.stack,
    })

    const apiError = APIError.internal(
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : error.message,
      error,
    )

    return NextResponse.json(apiError.toJSON(), {
      status: apiError.statusCode,
    })
  }

  // Unknown error type
  logger.error("Unknown error type in API", new Error(String(error)), {
    error: String(error),
  })

  const apiError = APIError.internal("An unexpected error occurred")
  return NextResponse.json(apiError.toJSON(), {
    status: apiError.statusCode,
  })
}

/**
 * Wrap async API handler with error handling
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>,
): (...args: T) => Promise<NextResponse> {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleAPIError(error)
    }
  }
}

/**
 * Type guard to check if error is operational
 */
export function isOperationalError(error: unknown): boolean {
  return error instanceof APIError && error.isOperational
}
