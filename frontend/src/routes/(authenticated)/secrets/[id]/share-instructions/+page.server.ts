import { redirect } from '@sveltejs/kit';
import { isBitcoinEnrollmentEnabled } from '$lib/server/bitcoin-enrollment';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) redirect(302, '/sign-in');
	return {
		bitcoinEnrollmentEnabled: isBitcoinEnrollmentEnabled()
	};
};
