import { createHash } from 'node:crypto';

const CHECK_IN_DOMAIN = 'keyfate:check-in:v2:';

/** Hash a high-entropy capability before persistence. */
export function hashCheckInToken(rawToken: string): string {
	return createHash('sha256').update(CHECK_IN_DOMAIN).update(rawToken).digest('hex');
}

/** A non-secret identifier suitable for security logs. */
export function fingerprintCapability(rawToken: string): string {
	return `sha256:${createHash('sha256').update(rawToken).digest('hex').slice(0, 12)}`;
}
