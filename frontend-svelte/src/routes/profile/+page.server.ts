import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserContactMethods } from '$lib/db/operations';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		redirect(302, '/sign-in');
	}

	const contactMethods = await getUserContactMethods(session.user.id);
	const first = contactMethods[0] ?? null;

	return {
		session,
		contactMethod: first
			? {
					email: first.email ?? '',
					phone: first.phone ?? '',
					preferredMethod: first.preferredMethod ?? 'email'
				}
			: null
	};
};
