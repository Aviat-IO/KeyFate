import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDatabase } from '$lib/db/drizzle';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
	createAutoLoginToken,
	deleteVerificationTokenById,
	getConsumableVerificationToken
} from '$lib/auth/email-verification';

const verifyEmailSchema = z.object({
	token: z.string().min(1, 'Token is required'),
	email: z.string().email('Invalid email address')
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
					error: 'Invalid request data',
					details: validation.error.issues
				},
				{ status: 400 }
			);
		}

		const { token, email } = validation.data;
		const normalizedEmail = email.toLowerCase().trim();

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

			const updateResult = await tx
				.update(users)
				.set({
					emailVerified: new Date(),
					updatedAt: new Date()
				} as any)
				.where(eq(users.email, normalizedEmail))
				.returning();

			const updatedUser = updateResult[0];
			if (!updatedUser) {
				return { status: 'not_found' as const };
			}

			await deleteVerificationTokenById(tx, {
				email: normalizedEmail,
				token,
				purpose: 'email_verification'
			});

			const verificationToken = await createAutoLoginToken(normalizedEmail, tx);

			return {
				status: 'verified' as const,
				updatedUser,
				verificationToken
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

		console.log(
			`[VerifyEmail] Successfully verified email for user: ${verificationResult.updatedUser.id}`
		);

		return json({
			success: true,
			verified: true,
			message: 'Email successfully verified',
			sessionToken: verificationResult.verificationToken,
			userId: verificationResult.updatedUser.id
		});
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
