import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSecret } from '$lib/db/operations';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		redirect(302, '/auth/signin');
	}

	const { id } = event.params;

	try {
		const secret = await getSecret(id, session.user.id);

		const initialData = {
			title: secret.title,
			recipients:
				secret.recipients.length > 0
					? secret.recipients.map((r) => ({
							name: r.name,
							email: r.email || '',
							phone: r.phone || ''
						}))
					: [{ name: '', email: '', phone: '' }],
			check_in_days: secret.checkInDays
		};

		return {
			session,
			secretId: secret.id,
			initialData
		};
	} catch (err) {
		console.error('Error loading secret for edit:', err);
		error(404, 'Secret not found');
	}
};
