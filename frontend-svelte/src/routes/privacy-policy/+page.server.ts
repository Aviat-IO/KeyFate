import type { PageServerLoad } from './$types';
import { NEXT_PUBLIC_COMPANY, NEXT_PUBLIC_PARENT_COMPANY, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SUPPORT_EMAIL } from '$lib/env';

export const load: PageServerLoad = async () => {
  return {
    company: NEXT_PUBLIC_COMPANY || 'KeyFate',
    parentCompany: NEXT_PUBLIC_PARENT_COMPANY || 'Aviat IO LLC',
    siteUrl: NEXT_PUBLIC_SITE_URL || 'https://keyfate.com',
    supportEmail: NEXT_PUBLIC_SUPPORT_EMAIL || 'support@keyfate.com',
  };
};
