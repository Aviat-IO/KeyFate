import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const session = await event.locals.auth();
  if (!session?.user?.id) {
    redirect(302, '/sign-in');
  }

  // TODO: Load export jobs and deletion requests from database
  // const db = await getDatabase();
  // const recentExports = await db.select()...
  // const [activeDeletion] = await db.select()...

  return {
    session,
    recentExports: [],
    activeDeletionRequest: null
  };
};
