import { getRequestContext } from "@/lib/request-context"

const SENSITIVE_FIELDS = [
  "serverShare",
  "encryptedShare",
  "secret",
  "token",
  "password",
  "key",
  "otp",
  "code",
  "apiKey",
  "apikey",
  "accessToken",
  "refreshToken",
  "privateKey",
  "encryptionKey",
  "csrfToken",
  "sessionToken",
  "session_token",
  "auth",
  "authorization",
  "bearer",
  "credential",
  "ssn",
  "social_security",
  "credit_card",
  "creditcard",
  "cvv",
  "pin",
  "secret_key",
  "secretkey",
  "signature",
  "hash",
]

function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase()
  return SENSITIVE_FIELDS.some((field) =>
    lowerKey.includes(field.toLowerCase()),
  )
}

/**
 * Sanitize potentially sensitive data for logging
 *
 * - Redacts sensitive field values
 * - Truncates long strings
 * - Masks email addresses (partial)
 * - Recursively processes nested objects
 */
function sanitize(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data
  }

  // Handle primitives
  if (typeof data !== "object") {
    // Truncate very long strings
    if (typeof data === "string" && data.length > 1000) {
      return data.substring(0, 100) + "...[truncated]"
    }
    return data
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item))
  }

  // Handle objects
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      // Redact sensitive fields completely
      sanitized[key] = "[REDACTED]"
    } else if (key === "email" && typeof value === "string") {
      // Partially mask email addresses: u***@example.com
      const parts = value.split("@")
      if (parts.length === 2) {
        sanitized[key] = `${parts[0][0]}***@${parts[1]}`
      } else {
        sanitized[key] = value
      }
    } else if (typeof value === "object" && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitize(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

interface LogEntry {
  level: "debug" | "info" | "warn" | "error"
  message: string
  timestamp: string
  data?: unknown
  error?: string
  stack?: string
  requestId?: string
  jobName?: string
  userId?: string
}

function createLogEntry(
  level: LogEntry["level"],
  message: string,
  data?: unknown,
  error?: Error,
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  }

  // Automatically include request context if available
  const context = getRequestContext()
  if (context) {
    if (context.requestId) entry.requestId = context.requestId
    if (context.jobName) entry.jobName = context.jobName
    if (context.userId) entry.userId = context.userId
  }

  if (data) {
    entry.data = sanitize(data)
  }

  if (error) {
    entry.error = error.message
    if (process.env.NODE_ENV !== "production") {
      entry.stack = error.stack
    }
  }

  return entry
}

export const logger = {
  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV === "development") {
      const entry = createLogEntry("debug", message, data)
      console.debug(JSON.stringify(entry))
    }
  },

  info: (message: string, data?: unknown) => {
    const entry = createLogEntry("info", message, data)
    console.log(JSON.stringify(entry))
  },

  warn: (message: string, data?: unknown) => {
    const entry = createLogEntry("warn", message, data)
    console.warn(JSON.stringify(entry))
  },

  error: (message: string, error?: Error, data?: unknown) => {
    const entry = createLogEntry("error", message, data, error)
    console.error(JSON.stringify(entry))

    if (typeof window !== "undefined" && (window as any).Sentry) {
      const Sentry = (window as any).Sentry
      Sentry.captureException(error || new Error(message), {
        extra: sanitize(data),
      })
    } else if (process.env.SENTRY_DSN) {
      try {
        const Sentry = require("@sentry/nextjs")
        Sentry.captureException(error || new Error(message), {
          extra: sanitize(data),
        })
      } catch (e) {}
    }
  },
}

export function withRequestId(requestId: string) {
  return {
    debug: (message: string, data?: unknown) => {
      logger.debug(message, {
        ...(typeof data === "object" ? data : {}),
        requestId,
      })
    },
    info: (message: string, data?: unknown) => {
      logger.info(message, {
        ...(typeof data === "object" ? data : {}),
        requestId,
      })
    },
    warn: (message: string, data?: unknown) => {
      logger.warn(message, {
        ...(typeof data === "object" ? data : {}),
        requestId,
      })
    },
    error: (message: string, error?: Error, data?: unknown) => {
      logger.error(message, error, {
        ...(typeof data === "object" ? data : {}),
        requestId,
      })
    },
  }
}
