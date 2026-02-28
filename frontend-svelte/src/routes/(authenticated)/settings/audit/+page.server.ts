import { redirect } from '@sveltejs/kit';
import { getUserTierInfo } from '$lib/subscription';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		redirect(302, '/sign-in');
	}

	const tierInfo = await getUserTierInfo(session.user.id);
	const userTier = (tierInfo?.tier?.tiers?.name ?? 'free') as 'free' | 'pro';

	return {
		session,
		userTier
	};
};
