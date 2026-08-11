import { describe, expect, it } from 'vitest';
import { renderDisclosureTemplate } from '../templates';

const base = {
	contactName: 'Recipient',
	secretTitle: 'Recovery fixture',
	senderName: 'Owner',
	message: 'Disclosure',
	secretContent: 'share'
};

describe('authenticated v3 disclosure instructions', () => {
	it('requires the retained setup bundle and never supplies a disclosure-time manifest', () => {
		const rendered = renderDisclosureTemplate({
			...base,
			secretContent: '{"scheme":"keyfate-shamir-chacha20poly1305","version":3}',
			nostrSchemeVersion: 3
		});

		expect(rendered.html).toContain('Authenticated Service Envelope (index 1)');
		expect(rendered.text).toContain('owner-delivered setup bundle');
		expect(rendered.text).toContain('Do not trust a replacement manifest');
		expect(rendered.text).toContain('/recover');
		expect(rendered.text).not.toContain('/decrypt');
		expect(rendered.text).not.toContain('Paste this signed manifest');
	});

	it('routes v2 manifests only through deliberate unverified legacy Nostr mode', () => {
		const rendered = renderDisclosureTemplate({
			...base,
			nostrSchemeVersion: 2,
			nostrManifest: '{"version":2}'
		});
		expect(rendered.text).toContain('enable Unverified legacy transport mode');
		expect(rendered.text).toContain('choose Nostr');
		expect(rendered.html).toContain('Unverified legacy transport mode');
	});

	it('escapes user-controlled HTML and removes header control characters', () => {
		const rendered = renderDisclosureTemplate({
			...base,
			contactName: '<img src=x onerror=alert(1)> & recipient',
			senderName: 'Owner\r\nBcc: attacker@example.com<script>x</script>',
			secretTitle: 'Title\nInjected: yes & <b>bold</b>',
			secretContent: '<script>share</script>&'
		});
		expect(rendered.subject).not.toMatch(/[\r\n]/);
		expect(rendered.subject).toContain('Bcc: attacker@example.com');
		expect(rendered.html).not.toContain('<script>');
		expect(rendered.html).not.toContain('<img src=x');
		expect(rendered.html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; recipient');
		expect(rendered.html).toContain('&lt;script&gt;share&lt;/script&gt;&amp;');
	});
});

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
