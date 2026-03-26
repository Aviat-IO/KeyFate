import type { LayoutServerLoad } from './$types';
import { requireAdmin } from '$lib/auth/admin-guard';

export const load: LayoutServerLoad = async (event) => {
	const session = await event.locals.auth();
	requireAdmin(session);
	return { session };
};
