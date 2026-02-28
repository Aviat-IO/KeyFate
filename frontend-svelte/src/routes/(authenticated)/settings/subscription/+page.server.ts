import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const session = await event.locals.auth();
  if (!session?.user?.id) {
    redirect(302, '/sign-in');
  }

  // TODO: Load tier info from database
  // const tierInfo = await getUserTierInfo(session.user.id);

  return {
    session,
    tierInfo: null // TODO: Load from DB
  };
};
