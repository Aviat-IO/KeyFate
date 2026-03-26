import { redirect, error } from '@sveltejs/kit';
import { getAllSecretsWithRecipients } from '$lib/db/queries/secrets';
import { getUserTierInfo } from '$lib/subscription';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		redirect(302, '/sign-in');
	}

	try {
		const [secrets, tierInfo] = await Promise.all([
			getAllSecretsWithRecipients(session.user.id),
			getUserTierInfo(session.user.id)
		]);

		return {
			session,
			secrets: secrets ?? [],
			canCreate: tierInfo?.limits?.secrets?.canCreate ?? true
		};
	} catch (err) {
		console.error('[Dashboard] Failed to load secrets:', err);
		error(500, 'Failed to load your secrets. Please try refreshing the page.');
	}
};
