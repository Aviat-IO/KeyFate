import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkRateLimit } from '$lib/auth/rate-limiting';
import {
	deletePasswordResetTokenById,
	getConsumablePasswordResetToken
} from '$lib/auth/password-reset';
import { validatePassword, hashPassword } from '$lib/auth/password';
import { getDatabase } from '$lib/db/drizzle';
import { users, sessions } from '$lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { APIError, handleAPIError } from '$lib/errors/api-error';
import { logger } from '$lib/logger';

export const POST: RequestHandler = async (event) => {
	try {
		const body = await event.request.json();
		const { token, password } = body;

		if (!token || !password) {
			throw APIError.validation('Token and password are required');
		}

		const rateLimit = await checkRateLimit('reset-password-attempt', token);
		if (!rateLimit.allowed) {
			throw APIError.rateLimit(
				`Too many password reset attempts. Please try again in ${Math.ceil(rateLimit.retryAfter! / 60)} minutes.`,
				rateLimit.retryAfter
			);
		}

		const passwordValidation = validatePassword(password);
		if (!passwordValidation.isValid) {
			throw APIError.validation(passwordValidation.message);
		}

		const hashedPassword = await hashPassword(password);
		const db = await getDatabase();
		const resetResult = await db.transaction(async (tx) => {
			const tokenValidation = await getConsumablePasswordResetToken(tx, token);
			if (!tokenValidation.isValid) {
				return {
					success: false as const,
					error: tokenValidation.error || 'Invalid or expired token'
				};
			}

			const invalidatedAt = new Date();

			await tx
				.update(users)
				.set({
					password: hashedPassword,
					updatedAt: invalidatedAt,
					sessionsInvalidatedAt: invalidatedAt,
					sessionVersion: sql`${users.sessionVersion} + 1`
				} as any)
				.where(eq(users.id, tokenValidation.userId!));

			await tx.delete(sessions).where(eq(sessions.userId, tokenValidation.userId!));
			await deletePasswordResetTokenById(tx, tokenValidation.tokenId!);

			return {
				success: true as const,
				userId: tokenValidation.userId!
			};
		});

		if (!resetResult.success) {
			throw APIError.validation(resetResult.error);
		}

		logger.info('Password reset successful', {
			userId: resetResult.userId,
			timestamp: new Date().toISOString()
		});

		return json({
			success: true,
			message: 'Password reset successfully. Please sign in with your new password.'
		});
	} catch (error) {
		const errorResponse = handleAPIError(error);
		return errorResponse;
	}
};
