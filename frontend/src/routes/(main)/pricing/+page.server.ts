import { getUserTierInfo } from '$lib/subscription';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();

	let userTier: string | undefined;
	let userTierDisplayName: string | undefined;

	if (session?.user?.id) {
		try {
			const tierInfo = await getUserTierInfo(session.user.id);
			if (tierInfo?.tier?.tiers) {
				userTier = tierInfo.tier.tiers.name;
				userTierDisplayName = tierInfo.tier.tiers.display_name;
			}
		} catch {
			// Fall through with undefined tier info
		}
	}

	return {
		session,
		userTier,
		userTierDisplayName
	};
};
