import { describe, expect, it } from 'vitest';
import { fingerprintCapability, hashCheckInToken } from '../capability-token';

describe('capability token storage', () => {
	it('uses a deterministic domain-separated one-way hash', () => {
		const raw = 'a'.repeat(64);
		const stored = hashCheckInToken(raw);

		expect(stored).toHaveLength(64);
		expect(stored).not.toBe(raw);
		expect(stored).toBe(hashCheckInToken(raw));
		expect(stored).not.toBe(hashCheckInToken('b'.repeat(64)));
	});

	it('logs only a short fingerprint', () => {
		const raw = 'recipient-capability';
		const fingerprint = fingerprintCapability(raw);
		expect(fingerprint).toMatch(/^sha256:[a-f0-9]{12}$/);
		expect(fingerprint).not.toContain(raw);
	});
});
