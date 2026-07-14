import { getRequestContext } from '$lib/request-context';

const SENSITIVE_FIELDS = [
	'serverShare',
	'encryptedShare',
	'secret',
	'token',
	'password',
	'key',
	'otp',
	'code',
	'apiKey',
	'apikey',
	'accessToken',
	'refreshToken',
	'privateKey',
	'encryptionKey',
	'csrfToken',
	'sessionToken',
	'session_token',
	'auth',
	'authorization',
	'bearer',
	'credential',
	'ssn',
	'social_security',
	'credit_card',
	'creditcard',
	'cvv',
	'pin',
	'secret_key',
	'secretkey',
	'signature',
	'hash',
	'title',
	'recipient',
	'recipientName',
	'contactEmail',
	'address',
	'passphrase',
	'envelope',
	'providerBody'
];

const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;

function shouldLog(level: keyof typeof LOG_LEVELS): boolean {
	const configured = (
		process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
	).toLowerCase() as keyof typeof LOG_LEVELS;
	return LOG_LEVELS[level] >= (LOG_LEVELS[configured] ?? LOG_LEVELS.info);
}

function isSensitiveKey(key: string): boolean {
	const lowerKey = key.toLowerCase();
	return SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()));
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
		return data;
	}

	// Handle primitives
	if (typeof data !== 'object') {
		if (typeof data === 'string') {
			const redacted = data
				.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
				.replace(/\b(?:nsec1|npub1)[023456789acdefghjklmnpqrstuvwxyz]{20,}\b/gi, '[REDACTED_NOSTR]')
				.replace(/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_]+\b/g, '[REDACTED_PROVIDER_KEY]');
			return redacted.length > 1000 ? `${redacted.substring(0, 100)}...[truncated]` : redacted;
		}
		return data;
	}

	// Handle arrays
	if (Array.isArray(data)) {
		return data.map((item) => sanitize(item));
	}

	// Handle objects
	const sanitized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		if (isSensitiveKey(key)) {
			// Redact sensitive fields completely
			sanitized[key] = '[REDACTED]';
		} else if (key === 'email' && typeof value === 'string') {
			// Partially mask email addresses: u***@example.com
			const parts = value.split('@');
			if (parts.length === 2) {
				sanitized[key] = `${parts[0][0]}***@${parts[1]}`;
			} else {
				sanitized[key] = value;
			}
		} else if (typeof value === 'object' && value !== null) {
			// Recursively sanitize nested objects
			sanitized[key] = sanitize(value);
		} else {
			sanitized[key] = value;
		}
	}
	return sanitized;
}

interface LogEntry {
	level: 'debug' | 'info' | 'warn' | 'error';
	message: string;
	timestamp: string;
	data?: unknown;
	error?: string;
	stack?: string;
	requestId?: string;
	jobName?: string;
	userId?: string;
}

function createLogEntry(
	level: LogEntry['level'],
	message: string,
	data?: unknown,
	error?: Error
): LogEntry {
	const entry: LogEntry = {
		level,
		message,
		timestamp: new Date().toISOString()
	};

	// Automatically include request context if available
	const context = getRequestContext();
	if (context) {
		if (context.requestId) entry.requestId = context.requestId;
		if (context.jobName) entry.jobName = context.jobName;
		if (context.userId) entry.userId = context.userId;
	}

	if (data) {
		entry.data = sanitize(data);
	}

	if (error) {
		entry.error = String(sanitize(error.message));
		if (process.env.NODE_ENV !== 'production') {
			entry.stack = error.stack;
		}
	}

	return entry;
}

export const logger = {
	debug: (message: string, data?: unknown) => {
		if (!shouldLog('debug')) return;
		console.debug(JSON.stringify(createLogEntry('debug', message, data)));
	},

	info: (message: string, data?: unknown) => {
		if (!shouldLog('info')) return;
		console.log(JSON.stringify(createLogEntry('info', message, data)));
	},

	warn: (message: string, data?: unknown) => {
		if (!shouldLog('warn')) return;
		console.warn(JSON.stringify(createLogEntry('warn', message, data)));
	},

	error: (message: string, error?: Error, data?: unknown) => {
		if (!shouldLog('error')) return;
		console.error(JSON.stringify(createLogEntry('error', message, data, error)));
	}
};

export function withRequestId(requestId: string) {
	return {
		debug: (message: string, data?: unknown) => {
			logger.debug(message, {
				...(typeof data === 'object' ? data : {}),
				requestId
			});
		},
		info: (message: string, data?: unknown) => {
			logger.info(message, {
				...(typeof data === 'object' ? data : {}),
				requestId
			});
		},
		warn: (message: string, data?: unknown) => {
			logger.warn(message, {
				...(typeof data === 'object' ? data : {}),
				requestId
			});
		},
		error: (message: string, error?: Error, data?: unknown) => {
			logger.error(message, error, {
				...(typeof data === 'object' ? data : {}),
				requestId
			});
		}
	};
}
