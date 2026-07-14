import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createOTPToken } from '$lib/auth/otp';
import { sendOTPEmail } from '$lib/email/email-service';
import { verifyTurnstileToken } from '$lib/auth/turnstile';
import { getClientIdentifier } from '$lib/rate-limit';
import { logger } from '$lib/logger';

export const POST: RequestHandler = async (event) => {
	try {
		const body = await event.request.json();
		const { email, acceptedPrivacyPolicy, turnstileToken } = body;

		if (!email || typeof email !== 'string') {
			return json({ error: 'Email is required' }, { status: 400 });
		}

		// Require privacy policy acceptance for new signups
		if (!acceptedPrivacyPolicy) {
			return json(
				{
					error: 'You must accept the Privacy Policy and Terms of Service to continue'
				},
				{ status: 400 }
			);
		}

		const clientIp = getClientIdentifier(event.request);
		const turnstileRequired =
			process.env.NODE_ENV === 'production' || Boolean(process.env.TURNSTILE_SECRET_KEY);
		if (turnstileRequired) {
			if (!turnstileToken || typeof turnstileToken !== 'string') {
				return json({ error: 'Please complete the security check' }, { status: 400 });
			}

			const isValidToken = await verifyTurnstileToken(turnstileToken, {
				expectedAction: 'request-otp',
				remoteIp: clientIp
			});
			if (!isValidToken) {
				return json({ error: 'Security verification failed. Please try again.' }, { status: 400 });
			}
		}

		const normalizedEmail = email.toLowerCase().trim();

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(normalizedEmail)) {
			return json({ error: 'Invalid email format' }, { status: 400 });
		}

		const otpResult = await createOTPToken(normalizedEmail, 'authentication', clientIp);
		if (!otpResult.success || !otpResult.code) {
			if (otpResult.reason === 'rate_limited') {
				return json({ error: otpResult.error }, { status: 429 });
			}
			if (otpResult.reason === 'unavailable') {
				return json({ error: otpResult.error }, { status: 503, headers: { 'Retry-After': '60' } });
			}
			logger.error('OTP challenge creation failed', undefined, { reason: otpResult.reason });
			return json({ error: 'Failed to generate OTP. Please try again.' }, { status: 500 });
		}

		const emailResult = await sendOTPEmail(normalizedEmail, otpResult.code, 5);
		if (!emailResult.success) {
			logger.error('OTP delivery failed', undefined, {
				provider: emailResult.provider,
				retryable: emailResult.retryable
			});
			return json({ error: 'Failed to send email. Please try again later.' }, { status: 500 });
		}

		return json({
			success: true,
			message: 'OTP sent successfully. Check your email.',
			remaining: otpResult.remaining
		});
	} catch (error) {
		logger.error('OTP request failed', error instanceof Error ? error : undefined);
		return json({ error: 'An unexpected error occurred' }, { status: 500 });
	}
};
