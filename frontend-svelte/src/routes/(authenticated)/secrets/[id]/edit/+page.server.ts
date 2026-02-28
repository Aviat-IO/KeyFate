import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const session = await event.locals.auth();
  if (!session?.user?.id) {
    redirect(302, '/auth/signin');
  }

  const { id } = event.params;

  // TODO: Load secret data from database for editing
  // const secret = await getSecret(id, session.user.id);
  // if (!secret) error(404, 'Secret not found');

  return {
    session,
    secretId: id
  };
};
