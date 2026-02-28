import { redirect, error } from '@sveltejs/kit';
import { getAllSecretsWithRecipients } from '$lib/db/queries/secrets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		redirect(302, '/sign-in');
	}

	try {
		const secrets = await getAllSecretsWithRecipients(session.user.id);

		return {
			session,
			secrets: secrets ?? []
		};
	} catch (err) {
		console.error('[Dashboard] Failed to load secrets:', err);
		error(500, 'Failed to load your secrets. Please try refreshing the page.');
	}
};
