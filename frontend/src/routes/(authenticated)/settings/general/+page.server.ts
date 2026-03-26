import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const session = await event.locals.auth();
  if (!session?.user?.id) {
    redirect(302, '/sign-in');
  }

  // TODO: Load user data from database
  // const db = await getDatabase();
  // const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  return {
    session,
    user: {
      name: session.user.name || 'Not set',
      email: session.user.email || '',
      joinDate: 'Unknown' // TODO: Load from DB
    }
  };
};
