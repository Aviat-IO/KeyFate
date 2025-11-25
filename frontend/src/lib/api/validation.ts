/**
 * Request Validation Middleware
 *
 * Provides Zod-based validation for API requests with standardized
 * error responses.
 */

import { NextRequest, NextResponse } from "next/server"
import { z, ZodError, ZodSchema } from "zod"
import { APIError } from "@/lib/errors/api-error"

/**
 * Common validation schemas for reuse
 */
export const commonSchemas = {
  /**
   * UUID validation
   */
  uuid: z.string().uuid({ message: "Invalid UUID format" }),

  /**
   * Email validation
   */
  email: z.string().email({ message: "Invalid email address" }),

  /**
   * Positive integer validation
   */
  positiveInt: z.number().int().positive(),

  /**
   * Non-negative integer validation
   */
  nonNegativeInt: z.number().int().min(0),

  /**
   * ISO 8601 date string validation
   */
  isoDate: z.string().datetime({ message: "Invalid ISO 8601 date format" }),

  /**
   * URL validation
   */
  url: z.string().url({ message: "Invalid URL format" }),

  /**
   * Password validation (min 8 chars, mixed case, number, special)
   */
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain lowercase letter")
    .regex(/[A-Z]/, "Password must contain uppercase letter")
    .regex(/[0-9]/, "Password must contain number")
    .regex(/[^a-zA-Z0-9]/, "Password must contain special character"),

  /**
   * OTP code validation (8 digits)
   */
  otpCode: z.string().regex(/^\d{8}$/, "OTP code must be 8 digits"),

  /**
   * Pagination limit
   */
  paginationLimit: z.coerce.number().int().min(1).max(100).default(20),

  /**
   * Pagination offset
   */
  paginationOffset: z.coerce.number().int().min(0).default(0),

  /**
   * Sort order
   */
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}

/**
 * Validation result
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: APIError }

/**
 * Validate request body against schema
 */
export async function validateBody<T extends ZodSchema>(
  request: NextRequest,
  schema: T,
): Promise<ValidationResult<z.infer<T>>> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: APIError.validation("Request validation failed", {
          errors: error.errors.map((err) => ({
            path: err.path.join("."),
            message: err.message,
            code: err.code,
          })),
        }),
      }
    }

    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: APIError.validation("Invalid JSON in request body"),
      }
    }

    return {
      success: false,
      error: APIError.internal("Failed to parse request body", error as Error),
    }
  }
}

/**
 * Validate URL search parameters against schema
 */
export function validateSearchParams<T extends ZodSchema>(
  searchParams: URLSearchParams,
  schema: T,
): ValidationResult<z.infer<T>> {
  try {
    // Convert URLSearchParams to object
    const params: Record<string, string | string[]> = {}
    for (const [key, value] of searchParams.entries()) {
      const existing = params[key]
      if (existing) {
        // Handle multiple values for same key
        params[key] = Array.isArray(existing)
          ? [...existing, value]
          : [existing, value]
      } else {
        params[key] = value
      }
    }

    const data = schema.parse(params)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: APIError.validation("Query parameter validation failed", {
          errors: error.errors.map((err) => ({
            path: err.path.join("."),
            message: err.message,
            code: err.code,
          })),
        }),
      }
    }

    return {
      success: false,
      error: APIError.internal(
        "Failed to validate query parameters",
        error as Error,
      ),
    }
  }
}

/**
 * Validate path parameters (from dynamic routes)
 */
export function validateParams<T extends ZodSchema>(
  params: Record<string, string | string[]>,
  schema: T,
): ValidationResult<z.infer<T>> {
  try {
    const data = schema.parse(params)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: APIError.validation("Path parameter validation failed", {
          errors: error.errors.map((err) => ({
            path: err.path.join("."),
            message: err.message,
            code: err.code,
          })),
        }),
      }
    }

    return {
      success: false,
      error: APIError.internal(
        "Failed to validate path parameters",
        error as Error,
      ),
    }
  }
}

/**
 * Higher-order function to wrap API handlers with validation
 */
export function withValidation<
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
>(
  schemas: {
    body?: ZodSchema<TBody>
    params?: ZodSchema<TParams>
    query?: ZodSchema<TQuery>
  },
  handler: (
    request: NextRequest,
    validated: {
      body?: TBody
      params?: TParams
      query?: TQuery
    },
  ) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string | string[]>> },
  ): Promise<NextResponse> => {
    const validated: {
      body?: TBody
      params?: TParams
      query?: TQuery
    } = {}

    // Validate body if schema provided
    if (schemas.body) {
      const bodyResult = await validateBody(request, schemas.body)
      if (!bodyResult.success) {
        return NextResponse.json(bodyResult.error.toJSON(), {
          status: bodyResult.error.statusCode,
        })
      }
      validated.body = bodyResult.data
    }

    // Validate params if schema provided
    if (schemas.params && context?.params) {
      const params = await context.params
      const paramsResult = validateParams(params, schemas.params)
      if (!paramsResult.success) {
        return NextResponse.json(paramsResult.error.toJSON(), {
          status: paramsResult.error.statusCode,
        })
      }
      validated.params = paramsResult.data
    }

    // Validate query if schema provided
    if (schemas.query) {
      const { searchParams } = new URL(request.url)
      const queryResult = validateSearchParams(searchParams, schemas.query)
      if (!queryResult.success) {
        return NextResponse.json(queryResult.error.toJSON(), {
          status: queryResult.error.statusCode,
        })
      }
      validated.query = queryResult.data
    }

    return handler(request, validated)
  }
}

/**
 * Sanitize string input (prevent XSS, SQL injection)
 *
 * Removes potentially dangerous characters while preserving
 * useful content for display purposes.
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove angle brackets (XSS prevention)
    .replace(/[^\w\s\-_.@]/gi, "") // Keep alphanumeric, spaces, and common symbols
}

/**
 * Sanitize HTML content (strip all HTML tags)
 *
 * For user-generated content that should be plain text only.
 */
export function sanitizeHtml(input: string): string {
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove script tags
    .replace(/<[^>]+>/g, "") // Remove all HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "") // Remove event handlers
}

/**
 * Sanitize markdown content (allow safe subset)
 *
 * Allows basic markdown while removing dangerous HTML/JS.
 */
export function sanitizeMarkdown(input: string): string {
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
}

/**
 * Sanitize user display name
 */
export function sanitizeDisplayName(input: string): string {
  return input
    .trim()
    .slice(0, 100) // Max length
    .replace(/[<>'"]/g, "") // Remove quotes and angle brackets
}

/**
 * Sanitize email for safe display
 */
export function sanitizeEmail(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]/g, "") // Only allow valid email characters
}

/**
 * Validate and sanitize array of strings
 */
export function sanitizeStringArray(input: string[]): string[] {
  return input.map(sanitizeString).filter((s) => s.length > 0)
}

/**
 * Sanitize URL (prevent javascript: and data: protocols)
 */
export function sanitizeUrl(input: string): string {
  const trimmed = input.trim().toLowerCase()

  // Block dangerous protocols
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("vbscript:")
  ) {
    return ""
  }

  return input.trim()
}

/**
 * Sanitize JSON string (validate before parsing)
 */
export function sanitizeJson(input: string): string | null {
  try {
    const parsed = JSON.parse(input)
    return JSON.stringify(parsed)
  } catch {
    return null
  }
}

/**
 * Check if value is valid JSON
 */
export function isValidJSON(value: string): boolean {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

/**
 * Common validation patterns
 */
export const validationPatterns = {
  /**
   * Alphanumeric with dashes and underscores
   */
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,

  /**
   * Hex color code
   */
  hexColor: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,

  /**
   * Semantic version
   */
  semver:
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,

  /**
   * Phone number (international format)
   */
  phone: /^\+?[1-9]\d{1,14}$/,

  /**
   * Base64 encoded string
   */
  base64: /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
}

/**
 * Create custom Zod refinement for async validation
 */
export function asyncRefinement<T>(
  validator: (value: T) => Promise<boolean>,
  message: string,
) {
  return async (value: T) => {
    const isValid = await validator(value)
    return isValid || message
  }
}
