import { redirect } from '@sveltejs/kit';
import { getDatabase } from '$lib/db/drizzle';
import { dataExportJobs, accountDeletionRequests } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		redirect(302, '/sign-in');
	}

	const userId = session.user.id;
	const db = await getDatabase();

	const recentExports = await db
		.select()
		.from(dataExportJobs)
		.where(eq(dataExportJobs.userId, userId))
		.orderBy(desc(dataExportJobs.createdAt))
		.limit(5);

	const [activeDeletion] = await db
		.select()
		.from(accountDeletionRequests)
		.where(eq(accountDeletionRequests.userId, userId))
		.orderBy(desc(accountDeletionRequests.createdAt))
		.limit(1);

	const activeDeletionRequest =
		activeDeletion &&
		(activeDeletion.status === 'pending' || activeDeletion.status === 'confirmed')
			? activeDeletion
			: null;

	return {
		session,
		recentExports: recentExports.map((e) => ({
			...e,
			createdAt: e.createdAt.toISOString(),
			expiresAt: e.expiresAt.toISOString(),
			completedAt: e.completedAt?.toISOString() ?? null
		})),
		activeDeletionRequest: activeDeletionRequest
			? {
					...activeDeletionRequest,
					createdAt: activeDeletionRequest.createdAt.toISOString(),
					confirmationSentAt: activeDeletionRequest.confirmationSentAt.toISOString(),
					confirmedAt: activeDeletionRequest.confirmedAt?.toISOString() ?? null,
					scheduledDeletionAt:
						activeDeletionRequest.scheduledDeletionAt?.toISOString() ?? null,
					cancelledAt: activeDeletionRequest.cancelledAt?.toISOString() ?? null,
					deletedAt: activeDeletionRequest.deletedAt?.toISOString() ?? null
				}
			: null
	};
};
