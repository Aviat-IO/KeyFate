const SENSITIVE_FIELDS = [
  "serverShare",
  "encryptedShare",
  "secret",
  "token",
  "password",
  "key",
  "otp",
  "apiKey",
  "apikey",
  "accessToken",
  "refreshToken",
  "privateKey",
  "encryptionKey",
]

function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase()
  return SENSITIVE_FIELDS.some((field) =>
    lowerKey.includes(field.toLowerCase()),
  )
}

function sanitize(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data
  }

  if (typeof data !== "object") {
    return data
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item))
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = "[REDACTED]"
    } else if (typeof value === "object" && value !== null) {
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
