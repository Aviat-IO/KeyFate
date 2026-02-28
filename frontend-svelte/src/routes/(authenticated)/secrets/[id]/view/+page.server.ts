import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSecret } from '$lib/db/operations';
import { getDatabase } from '$lib/db/get-database';
import { checkinHistory } from '$lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		redirect(302, '/auth/signin');
	}

	const { id } = event.params;

	try {
		const secret = await getSecret(id, session.user.id);

		// Load check-in history
		const db = await getDatabase();
		const history = await db
			.select({
				checkedInAt: checkinHistory.checkedInAt,
				nextCheckIn: checkinHistory.nextCheckIn
			})
			.from(checkinHistory)
			.where(
				and(eq(checkinHistory.secretId, id), eq(checkinHistory.userId, session.user.id))
			)
			.orderBy(desc(checkinHistory.checkedInAt))
			.limit(20);

		return {
			session,
			secret: {
				id: secret.id,
				userId: secret.userId,
				title: secret.title,
				status: secret.status,
				checkInDays: secret.checkInDays,
				lastCheckIn: secret.lastCheckIn?.toISOString() ?? null,
				nextCheckIn: secret.nextCheckIn?.toISOString() ?? null,
				triggeredAt: secret.triggeredAt?.toISOString() ?? null,
				serverShare: secret.serverShare,
				sssSharesTotal: secret.sssSharesTotal,
				sssThreshold: secret.sssThreshold,
				createdAt: secret.createdAt.toISOString(),
				updatedAt: secret.updatedAt.toISOString(),
				recipients: secret.recipients.map((r) => ({
					id: r.id,
					name: r.name,
					email: r.email,
					phone: r.phone
				}))
			},
			checkInHistory: history.map((h) => ({
				checkedInAt: h.checkedInAt.toISOString(),
				nextCheckIn: h.nextCheckIn.toISOString()
			}))
		};
	} catch (err) {
		console.error('Error loading secret for view:', err);
		error(404, 'Secret not found');
	}
};
