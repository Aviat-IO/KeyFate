import type { RequestEvent } from '@sveltejs/kit';
import { getDatabase } from '$lib/db/drizzle';
import { csrfTokens } from '$lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import crypto from 'crypto';

export async function generateCSRFToken(sessionId: string): Promise<string> {
	const db = await getDatabase();
	const token = crypto.randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

	await db.insert(csrfTokens).values({
		sessionId,
		token,
		expiresAt
	});

	return token;
}

export async function validateCSRFToken(sessionId: string, token: string): Promise<boolean> {
	const db = await getDatabase();

	const [consumed] = await db
		.delete(csrfTokens)
		.where(
			and(
				eq(csrfTokens.sessionId, sessionId),
				eq(csrfTokens.token, token),
				gt(csrfTokens.expiresAt, new Date())
			)
		)
		.returning({ id: csrfTokens.id });

	return Boolean(consumed);
}

export async function requireCSRFProtection(
	event: RequestEvent
): Promise<{ valid: boolean; error?: string }> {
	const session = await event.locals.auth();
	if (!session) {
		return { valid: false, error: 'Authentication required' };
	}

	// 1. Origin validation
	const request = event.request;
	const origin = request.headers.get('origin');

	if (!origin || origin === 'null') {
		return { valid: false, error: 'Missing or invalid origin header' };
	}

	try {
		const expectedOrigin = process.env.ORIGIN || event.url.origin;
		if (new URL(origin).origin !== new URL(expectedOrigin).origin) {
			return { valid: false, error: 'Origin mismatch - potential CSRF attack' };
		}
	} catch {
		return { valid: false, error: 'Missing or invalid origin header' };
	}

	// 2. CSRF token validation
	const csrfToken = request.headers.get('x-csrf-token');
	if (!csrfToken) {
		return { valid: false, error: 'Missing CSRF token' };
	}

	const userId = session.user?.id;
	if (!userId) {
		return { valid: false, error: 'Invalid session' };
	}

	const tokenValid = await validateCSRFToken(userId, csrfToken);
	if (!tokenValid) {
		return { valid: false, error: 'Invalid or expired CSRF token' };
	}

	return { valid: true };
}

export function createCSRFErrorResponse() {
	return new Response(
		JSON.stringify({
			error: 'CSRF validation failed',
			message: 'Request origin validation failed'
		}),
		{
			status: 403,
			headers: { 'Content-Type': 'application/json' }
		}
	);
}
