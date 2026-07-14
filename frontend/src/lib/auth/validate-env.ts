import { validateProductionConfig } from '$lib/server/production-config';
import { validateOAuthConfig } from '$lib/auth/oauth-config-validator';

export function validateAuthEnvironment(): { isValid: boolean; missing: string[] } {
	const oauth = validateOAuthConfig();
	const production = validateProductionConfig();
	const errors = [...oauth.errors, ...production.errors];
	return {
		isValid: errors.length === 0,
		missing: errors
	};
}
