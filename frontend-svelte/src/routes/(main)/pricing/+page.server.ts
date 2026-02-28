import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const session = await event.locals.auth();

  // TODO: Load tier info if user is logged in
  // if (session?.user?.id) {
  //   const tierInfo = await getUserTierInfo(session.user.id);
  //   ...
  // }

  return {
    session,
    userTier: undefined as string | undefined,
    userTierDisplayName: undefined as string | undefined
  };
};
