import { getDatabase } from '$lib/db/drizzle';
import { passwordResetTokens, users } from '$lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { generateHexToken, hashToken } from '$lib/auth/token-utils';

type DatabaseExecutor = any;

export async function generatePasswordResetToken(userId: string): Promise<string> {
	const db = await getDatabase();
	const token = generateHexToken();
	const tokenHash = hashToken(token);
	const expires = new Date(Date.now() + 60 * 60 * 1000);

	await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));

	await db.insert(passwordResetTokens).values({
		userId,
		token: tokenHash,
		expires
	});

	return token;
}

export async function validatePasswordResetToken(token: string): Promise<{
	isValid: boolean;
	userId?: string;
	error?: string;
}> {
	const db = await getDatabase();
	const tokenHash = hashToken(token);
	const resetTokens = await db
		.select()
		.from(passwordResetTokens)
		.where(eq(passwordResetTokens.token, tokenHash))
		.limit(1);

	if (resetTokens.length === 0) {
		return { isValid: false, error: 'Invalid token' };
	}

	const resetToken = resetTokens[0];

	if (new Date() > resetToken.expires) {
		await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, resetToken.id));
		return { isValid: false, error: 'Token expired' };
	}

	return { isValid: true, userId: resetToken.userId };
}

export async function deletePasswordResetToken(token: string): Promise<void> {
	const db = await getDatabase();
	await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, hashToken(token)));
}

export async function deletePasswordResetTokenById(
	executor: DatabaseExecutor,
	tokenId: string
): Promise<void> {
	await executor.delete(passwordResetTokens).where(eq(passwordResetTokens.id, tokenId));
}

export async function getConsumablePasswordResetToken(
	executor: DatabaseExecutor,
	token: string
): Promise<{
	isValid: boolean;
	userId?: string;
	tokenId?: string;
	error?: string;
}> {
	const tokenHash = hashToken(token);
	const [resetToken] = await executor
		.select()
		.from(passwordResetTokens)
		.where(eq(passwordResetTokens.token, tokenHash))
		.for('update');

	if (!resetToken) {
		return { isValid: false, error: 'Invalid token' };
	}

	if (new Date() > resetToken.expires) {
		await deletePasswordResetTokenById(executor, resetToken.id);
		return { isValid: false, error: 'Token expired' };
	}

	return {
		isValid: true,
		userId: resetToken.userId,
		tokenId: resetToken.id
	};
}

export async function consumePasswordResetToken(token: string): Promise<{
	isValid: boolean;
	userId?: string;
	error?: string;
}> {
	const db = await getDatabase();
	const tokenHash = hashToken(token);
	const now = new Date();

	const consumedTokens = await db
		.delete(passwordResetTokens)
		.where(and(eq(passwordResetTokens.token, tokenHash), gt(passwordResetTokens.expires, now)))
		.returning({ userId: passwordResetTokens.userId });

	if (consumedTokens.length > 0) {
		return { isValid: true, userId: consumedTokens[0].userId };
	}

	return await validatePasswordResetToken(token);
}

export async function canRequestPasswordReset(email: string): Promise<{
	canReset: boolean;
	error?: string;
}> {
	const db = await getDatabase();
	const userResults = await db.select().from(users).where(eq(users.email, email)).limit(1);

	if (userResults.length === 0) {
		return { canReset: false };
	}

	const user = userResults[0];

	if (!user.password) {
		return {
			canReset: false,
			error: 'OAuth-only accounts cannot reset password'
		};
	}

	if (!user.emailVerified) {
		return { canReset: false, error: 'Email not verified' };
	}

	return { canReset: true };
}
