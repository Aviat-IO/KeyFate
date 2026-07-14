import { describe, expect, it } from 'vitest';
import { renderDisclosureTemplate } from '../templates';

const base = {
	contactName: 'Recipient',
	secretTitle: 'Recovery fixture',
	senderName: 'Owner',
	message: 'Disclosure',
	secretContent: 'share'
};

describe('Bitcoin disclosure generation binding', () => {
	it('prints the independently supplied current generation with the envelope', () => {
		const rendered = renderDisclosureTemplate({
			...base,
			bitcoinRecoveryEnvelope: '{"ciphertext":"encrypted"}',
			bitcoinRecoverySenderPubkey: 'a'.repeat(64),
			bitcoinRecoveryGeneration: 3
		});

		expect(rendered.html).toContain('Expected current generation:</strong> 3');
		expect(rendered.text).toContain('Expected current generation: 3');
		expect(rendered.text).toContain('Reject any envelope whose generation does not match');
	});

	it('omits an envelope when current-generation metadata is unavailable', () => {
		const rendered = renderDisclosureTemplate({
			...base,
			bitcoinRecoveryEnvelope: '{"ciphertext":"encrypted"}',
			bitcoinRecoverySenderPubkey: 'a'.repeat(64)
		});

		expect(rendered.html).not.toContain('Bitcoin Delayed Recovery');
		expect(rendered.text).not.toContain('{"ciphertext":"encrypted"}');
	});
});
