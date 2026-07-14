import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkRateLimit } from '$lib/auth/rate-limiting';
import { getDatabase } from '$lib/db/drizzle';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
	deleteVerificationTokenById,
	getConsumableVerificationToken
} from '$lib/auth/email-verification';

const verifyEmailSchema = z.object({
	email: z.string().email('Invalid email address'),
	token: z.string().min(1, 'Token is required')
});

export const POST: RequestHandler = async (event) => {
	try {
		const db = await getDatabase();
		const body = await event.request.json();

		// Validate request body
		const validation = verifyEmailSchema.safeParse(body);
		if (!validation.success) {
			return json(
				{
					success: false,
					error: 'Email and token are required',
					details: validation.error.issues
				},
				{ status: 400 }
			);
		}

		const { email, token } = validation.data;
		const normalizedEmail = email.toLowerCase().trim();

		// Check rate limit
		const rateLimitResult = await checkRateLimit('verify-email', normalizedEmail);
		if (!rateLimitResult.allowed) {
			return new Response(
				JSON.stringify({
					success: false,
					error: 'Too many verification attempts. Please try again later.',
					retryAfter: rateLimitResult.retryAfter
				}),
				{
					status: 429,
					headers: {
						'Content-Type': 'application/json',
						'Retry-After': rateLimitResult.retryAfter?.toString() || '300',
						'X-RateLimit-Remaining': '0',
						'X-RateLimit-Reset': rateLimitResult.resetTime.toISOString()
					}
				}
			);
		}

		const verificationResult = await db.transaction(async (tx) => {
			const tokenResult = await getConsumableVerificationToken(tx, {
				email: normalizedEmail,
				token,
				purpose: 'email_verification'
			});

			if (!tokenResult.success) {
				return {
					status: 'invalid' as const,
					error: tokenResult.error
				};
			}

			const userResult = await tx
				.select()
				.from(users)
				.where(eq(users.email, normalizedEmail))
				.limit(1);
			const user = userResult[0];

			if (!user) {
				return { status: 'not_found' as const };
			}

			if (user.emailVerified) {
				await deleteVerificationTokenById(tx, {
					email: normalizedEmail,
					token,
					purpose: 'email_verification'
				});

				return {
					status: 'already_verified' as const,
					user
				};
			}

			await tx
				.update(users)
				.set({
					emailVerified: new Date(),
					updatedAt: new Date()
				} as any)
				.where(eq(users.id, user.id));

			await deleteVerificationTokenById(tx, {
				email: normalizedEmail,
				token,
				purpose: 'email_verification'
			});

			return {
				status: 'verified' as const,
				user
			};
		});

		if (verificationResult.status === 'invalid') {
			return json(
				{
					success: false,
					error:
						verificationResult.error === 'Token expired'
							? 'Verification token has expired'
							: 'Invalid or expired verification token'
				},
				{ status: 400 }
			);
		}

		if (verificationResult.status === 'not_found') {
			return json(
				{
					success: false,
					error: 'User not found'
				},
				{ status: 404 }
			);
		}

		if (verificationResult.status === 'already_verified') {
			return new Response(
				JSON.stringify({
					success: true,
					verified: true,
					message: 'Email is already verified',
					user: {
						id: verificationResult.user.id,
						email: verificationResult.user.email
					}
				}),
				{
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
						'X-RateLimit-Reset': rateLimitResult.resetTime.toISOString()
					}
				}
			);
		}

		console.log(
			`[VerifyEmail] Successfully verified email for user: ${verificationResult.user.id}`
		);

		return new Response(
			JSON.stringify({
				success: true,
				verified: true,
				user: {
					id: verificationResult.user.id,
					email: verificationResult.user.email
				}
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
					'X-RateLimit-Reset': rateLimitResult.resetTime.toISOString()
				}
			}
		);
	} catch (error) {
		console.error('[VerifyEmail] Unexpected error:', error);

		return json(
			{
				success: false,
				error: 'An unexpected error occurred during verification'
			},
			{ status: 500 }
		);
	}
};
