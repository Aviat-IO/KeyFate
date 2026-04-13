const DEFAULT_REDIRECT = '/dashboard';

export function getSafeRedirectTarget(
	target: string | null | undefined,
	currentOrigin: string,
	fallback = DEFAULT_REDIRECT
): string {
	const trimmedTarget = target?.trim();

	if (!trimmedTarget) {
		return fallback;
	}

	if (trimmedTarget.startsWith('/')) {
		return trimmedTarget.startsWith('//') ? fallback : trimmedTarget;
	}

	try {
		const url = new URL(trimmedTarget);

		if (url.origin !== currentOrigin) {
			return fallback;
		}

		return `${url.pathname}${url.search}${url.hash}` || '/';
	} catch {
		return fallback;
	}
}
