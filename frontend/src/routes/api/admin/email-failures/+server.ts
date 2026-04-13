/**
 * Email Failures Admin API
 *
 * GET /api/admin/email-failures - List failed emails with filtering
 * Provides admin interface for viewing and managing email failures
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { DeadLetterQueue } from '$lib/email/dead-letter-queue';
import { requireAdmin } from '$lib/auth/admin-guard';

/**
 * GET /api/admin/email-failures
 *
 * Query failed emails with optional filters
 *
 * Query params:
 * - emailType: reminder | disclosure | admin_notification | verification
 * - provider: sendgrid | console-dev | resend
 * - recipient: email address
 * - unresolvedOnly: true | false
 * - limit: number (default 100)
 * - offset: number (default 0)
 * - stats: true | false (return stats instead of failures)
 */
export const GET: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	requireAdmin(session);

	try {
		const { searchParams } = event.url;

		// Check if stats requested
		if (searchParams.get('stats') === 'true') {
			const dlq = new DeadLetterQueue();
			const stats = await dlq.getStats();
			return json(stats);
		}

		// Parse query parameters
		const emailType = searchParams.get('emailType') as any;
		const provider = searchParams.get('provider') as any;
		const recipient = searchParams.get('recipient') || undefined;
		const unresolvedOnly = searchParams.get('unresolvedOnly') === 'true';
		const limit = parseInt(searchParams.get('limit') || '100');
		const offset = parseInt(searchParams.get('offset') || '0');

		const dlq = new DeadLetterQueue();
		const failures = await dlq.queryFailures({
			emailType,
			provider,
			recipient,
			unresolvedOnly,
			limit,
			offset
		});

		return json({
			failures,
			count: failures.length,
			limit,
			offset
		});
	} catch (error) {
		console.error('[admin/email-failures] GET error:', error);

		return json(
			{
				error: 'Failed to query email failures',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
