import { describe, expect, it } from 'vitest';

import {
	buildAuthLoginRedirectPath,
	buildSignUpRedirectUrl,
	resolveEmailVerificationCallbackUrl
} from '../redirect-callers';

describe('redirect callers', () => {
	it('buildSignUpRedirectUrl preserves only sanitized callbackUrl and next values', () => {
		const url = new URL(
			'https://keyfate.com/sign-up?callbackUrl=https://evil.example/phish&next=/settings/security'
		);

		expect(buildSignUpRedirectUrl(url)).toBe(
			'/auth/signin?callbackUrl=%2Fdashboard&next=%2Fsettings%2Fsecurity'
		);
	});

	it('buildAuthLoginRedirectPath normalizes same-origin next values for sign-in', () => {
		const url = new URL(
			`https://keyfate.com/auth/login?next=${encodeURIComponent('https://keyfate.com/billing?plan=pro#summary')}`
		);

		expect(buildAuthLoginRedirectPath(url)).toBe(
			'/sign-in?callbackUrl=%2Fbilling%3Fplan%3Dpro%23summary'
		);
	});

	it('resolveEmailVerificationCallbackUrl prefers query callbackUrl when prop is absent', () => {
		const searchParams = new URLSearchParams('callbackUrl=/secrets/new');

		expect(
			resolveEmailVerificationCallbackUrl(undefined, searchParams, 'https://keyfate.com')
		).toBe('/secrets/new');
	});

	it('resolveEmailVerificationCallbackUrl prefers prop callbackUrl over query', () => {
		const searchParams = new URLSearchParams('callbackUrl=/secrets/new');

		expect(
			resolveEmailVerificationCallbackUrl(
				'/dashboard?tab=billing',
				searchParams,
				'https://keyfate.com'
			)
		).toBe('/dashboard?tab=billing');
	});
});
