import type { PageServerLoad } from './$types';
import { COMPANY, PARENT_COMPANY, SITE_URL, SUPPORT_EMAIL } from '$lib/env';

export const load: PageServerLoad = async () => {
  return {
    company: COMPANY || 'KeyFate',
    parentCompany: PARENT_COMPANY || 'Aviat IO LLC',
    siteUrl: SITE_URL || 'https://keyfate.com',
    supportEmail: SUPPORT_EMAIL || 'support@keyfate.com',
  };
};
