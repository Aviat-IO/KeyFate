import { describe, expect, it } from 'vitest';

import { getSafeRedirectTarget } from '../redirects';

describe('getSafeRedirectTarget', () => {
	it('keeps internal relative paths', () => {
		expect(getSafeRedirectTarget('/dashboard?tab=billing#plans', 'https://keyfate.com')).toBe(
			'/dashboard?tab=billing#plans'
		);
	});

	it('normalizes same-origin absolute URLs to internal paths', () => {
		expect(
			getSafeRedirectTarget(
				'https://keyfate.com/settings/profile?from=email#security',
				'https://keyfate.com'
			)
		).toBe('/settings/profile?from=email#security');
	});

	it('rejects external absolute URLs', () => {
		expect(getSafeRedirectTarget('https://evil.example/phish', 'https://keyfate.com')).toBe(
			'/dashboard'
		);
	});

	it('rejects protocol-relative URLs', () => {
		expect(getSafeRedirectTarget('//evil.example/phish', 'https://keyfate.com')).toBe('/dashboard');
	});
});
