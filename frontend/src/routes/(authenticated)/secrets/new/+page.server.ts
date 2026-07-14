import { redirect } from '@sveltejs/kit';
import { getUserTierInfo } from '$lib/subscription';
import { isBitcoinEnrollmentEnabled } from '$lib/server/bitcoin-enrollment';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		redirect(302, '/sign-in');
	}

	const tierInfo = await getUserTierInfo(session.user.id);

	const bitcoinEnrollmentEnabled = isBitcoinEnrollmentEnabled();

	if (!tierInfo) {
		return {
			session,
			tierInfo: null,
			bitcoinEnrollmentEnabled
		};
	}

	return {
		session,
		bitcoinEnrollmentEnabled,
		tierInfo: {
			isPaid: tierInfo.tier.tiers.name === 'pro',
			secretsUsed: tierInfo.limits.secrets.current,
			secretsLimit: tierInfo.limits.secrets.max,
			canCreate: tierInfo.limits.secrets.canCreate,
			recipientsLimit: tierInfo.limits.recipients.max
		}
	};
};
