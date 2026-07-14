import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handle as authHandle } from './auth';
import { startScheduler, stopScheduler } from '$lib/cron/scheduler';
import { closeDatabaseConnection } from '$lib/db/drizzle';
import { assertProductionConfig } from '$lib/server/production-config';
import { withRequestContext } from '$lib/request-context';
import { logger } from '$lib/logger';
import { createShutdownController } from '$lib/server/lifecycle';

const middlewareHandle: Handle = async ({ event, resolve }) => {
	const requestId = crypto.randomUUID();
	return withRequestContext({ requestId, startTime: Date.now() }, async () => {
		const { pathname } = event.url;
		if (process.env.NODE_ENV === 'production') {
			const proto = event.request.headers.get('x-forwarded-proto');
			if (proto && proto !== 'https') {
				const url = new URL(event.url);
				url.protocol = 'https:';
				throw redirect(301, url.toString());
			}
		}

		const session = await event.locals.auth();
		if (
			session?.user &&
			(pathname === '/sign-in' || pathname === '/auth/signin' || pathname === '/login')
		) {
			throw redirect(303, '/dashboard');
		}

		if (session?.user) {
			const verificationExemptRoutes = [
				'/auth/verify-email',
				'/auth/verify-email-nextauth',
				'/api/auth/verify-email',
				'/api/auth/verify-email-nextauth',
				'/api/auth/resend-verification',
				'/api/auth/verification-status',
				'/auth/signin',
				'/sign-in',
				'/sign-up',
				'/auth/error',
				'/check-in',
				'/api/check-in',
				'/api/auth'
			];
			const exempt = verificationExemptRoutes.some(
				(route) => pathname === route || pathname.startsWith(`${route}/`)
			);
			const verified = (session.user as { emailVerified?: Date | null }).emailVerified;
			if (!verified && !exempt) throw redirect(303, '/auth/verify-email');
		}

		const response = await resolve(event);
		response.headers.set('x-request-id', requestId);
		response.headers.set('X-Frame-Options', 'DENY');
		response.headers.set('X-Content-Type-Options', 'nosniff');
		response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
		response.headers.set('X-XSS-Protection', '0');
		response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
		if (process.env.NODE_ENV === 'production') {
			response.headers.set(
				'Strict-Transport-Security',
				'max-age=31536000; includeSubDomains; preload'
			);
		}
		return response;
	});
};

export const handle: Handle = sequence(authHandle, middlewareHandle);

let lifecycleHandlersInstalled = false;

const shutdownController = createShutdownController({
	cleanup: async () => {
		await stopScheduler();
		await closeDatabaseConnection();
	},
	exit: (code) => process.exit(code),
	logger
});

export const init: ServerInit = async () => {
	assertProductionConfig();
	startScheduler();

	if (lifecycleHandlersInstalled) return;
	lifecycleHandlersInstalled = true;

	process.once('SIGTERM', () => void shutdownController.shutdown('SIGTERM', 0));
	process.once('SIGINT', () => void shutdownController.shutdown('SIGINT', 0));
	process.once('uncaughtException', (error) => {
		logger.error('Uncaught exception', error);
		void shutdownController.shutdown('uncaughtException', 1);
	});
	process.once('unhandledRejection', (reason) => {
		logger.error('Unhandled rejection', reason instanceof Error ? reason : undefined);
		void shutdownController.shutdown('unhandledRejection', 1);
	});
};
