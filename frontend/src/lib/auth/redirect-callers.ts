import { getSafeRedirectTarget } from './redirects';

export function buildSignUpRedirectUrl(url: URL): string {
	const rawCallbackUrl = url.searchParams.get('callbackUrl');
	const rawNext = url.searchParams.get('next');
	const callbackUrl = getSafeRedirectTarget(rawCallbackUrl, url.origin);
	const next = getSafeRedirectTarget(rawNext, url.origin);

	let redirectUrl = '/auth/signin';
	const params = new URLSearchParams();

	if (rawCallbackUrl) params.set('callbackUrl', callbackUrl);
	if (rawNext) params.set('next', next);
	if (params.toString()) redirectUrl += `?${params.toString()}`;

	return redirectUrl;
}

export function buildAuthLoginRedirectPath(url: URL): string {
	const nextUrl = url.searchParams.get('next');

	if (!nextUrl) {
		return '/sign-in';
	}

	const callbackUrl = getSafeRedirectTarget(nextUrl, url.origin);
	return `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export function resolveEmailVerificationCallbackUrl(
	callbackUrlProp: string | undefined,
	searchParams: URLSearchParams,
	origin: string
): string {
	return getSafeRedirectTarget(callbackUrlProp ?? searchParams.get('callbackUrl'), origin);
}
