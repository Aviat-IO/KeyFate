import { describe, expect, it } from 'vitest';
import { createAuthenticatedRecoverySet, parseRecoveryShareEnvelope } from '../crypto/recovery-v3';
import {
	buildSharedRecipientShareAssignments,
	clearEphemeralRecoveryState,
	getEphemeralRecoveryState,
	partitionRecoveryShares,
	setEphemeralBitcoinSetup,
	setEphemeralRecoveryState
} from './ephemeral-recovery-state';

describe('partitionRecoveryShares', () => {
	it('assigns the same logical index-2 envelope to every recipient', () => {
		const { envelopes } = createAuthenticatedRecoverySet('shared recipient secret', {
			threshold: 2,
			total: 4
		});
		const result = partitionRecoveryShares(envelopes.slice(1), 3);

		expect(result.recipientShares).toEqual([envelopes[1], envelopes[1], envelopes[1]]);
		expect(result.recipientShares.map((share) => parseRecoveryShareEnvelope(share).index)).toEqual([
			2, 2, 2
		]);
		expect(result.backupShares).toEqual(envelopes.slice(2));
	});

	it('keeps every user-managed envelope as an owner backup when there are no recipients', () => {
		const { envelopes } = createAuthenticatedRecoverySet('owner only', {
			threshold: 2,
			total: 3
		});
		expect(partitionRecoveryShares(envelopes.slice(1), 0)).toEqual({
			recipientShares: [],
			backupShares: envelopes.slice(1)
		});
	});

	it('fails closed when recipients exist but the shared index-2 envelope is missing', () => {
		expect(() => partitionRecoveryShares([], 1)).toThrow('Shared recipient recovery envelope');
	});

	it('fails closed for malformed or out-of-order envelopes', () => {
		const { envelopes } = createAuthenticatedRecoverySet('secret', { threshold: 2, total: 3 });
		expect(() => partitionRecoveryShares(['not-an-envelope'], 1)).toThrow();
		expect(() => partitionRecoveryShares([envelopes[2], envelopes[1]], 1)).toThrow(
			'expected recovery share index'
		);
	});

	it('fails closed for invalid recipient counts', () => {
		const { envelopes } = createAuthenticatedRecoverySet('secret', { threshold: 2, total: 3 });
		expect(() => partitionRecoveryShares(envelopes.slice(1), -1)).toThrow(
			'Recipient count must be a non-negative integer'
		);
	});

	it('builds Nostr assignments from the envelope embedded index rather than recipient position', () => {
		const { envelopes } = createAuthenticatedRecoverySet('secret', { threshold: 2, total: 3 });
		expect(
			buildSharedRecipientShareAssignments(['recipient-a', 'recipient-b'], envelopes.slice(1))
		).toEqual([
			{ recipientId: 'recipient-a', share: envelopes[1], shareIndex: 2 },
			{ recipientId: 'recipient-b', share: envelopes[1], shareIndex: 2 }
		]);
	});
});

const stateMetadata = {
	recipients: [{ name: 'Recipient', email: 'recipient@example.com' }],
	threshold: 2,
	totalShares: 3
};

describe('ephemeral Bitcoin setup material', () => {
	it('clones real Nostr bindings in memory and zeroes caller K bytes', () => {
		const secretId = '550e8400-e29b-41d4-a716-446655440000';
		const plaintextK = new Uint8Array(32).fill(7);
		const event = {
			id: '11'.repeat(32),
			pubkey: '22'.repeat(32),
			created_at: 1,
			kind: 1,
			tags: [],
			content: '',
			sig: '33'.repeat(64)
		};
		setEphemeralRecoveryState({
			secretId,
			shares: ['share'],
			...stateMetadata,
			createdAt: Date.now()
		});
		setEphemeralBitcoinSetup(secretId, {
			recipientId: '660e8400-e29b-41d4-a716-446655440000',
			recipientName: 'Recipient',
			recipientNostrPubkey: '44'.repeat(32),
			nostrCapsuleEventId: event.id,
			nostrManifestEvent: event,
			nostrCapsuleEvent: event,
			plaintextK
		});
		expect(plaintextK.every((byte) => byte === 0)).toBe(true);
		expect(getEphemeralRecoveryState(secretId)?.bitcoin?.plaintextK).toEqual(
			new Uint8Array(32).fill(7)
		);
		clearEphemeralRecoveryState(secretId);
		expect(getEphemeralRecoveryState(secretId)).toBeNull();
	});

	it('actively expires recovery material even when no getter is called', () => {
		const secretId = '770e8400-e29b-41d4-a716-446655440000';
		const originalSetTimeout = globalThis.setTimeout;
		const originalClearTimeout = globalThis.clearTimeout;
		let expire: (() => void) | undefined;
		globalThis.setTimeout = ((callback: TimerHandler) => {
			expire = callback as () => void;
			return 123 as unknown as ReturnType<typeof setTimeout>;
		}) as unknown as typeof setTimeout;
		globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;
		try {
			setEphemeralRecoveryState({
				secretId,
				shares: ['sensitive-share'],
				...stateMetadata,
				createdAt: Date.now()
			});
			expect(expire).toBeDefined();
			expire?.();
			expect(getEphemeralRecoveryState(secretId)).toBeNull();
		} finally {
			globalThis.setTimeout = originalSetTimeout;
			globalThis.clearTimeout = originalClearTimeout;
			clearEphemeralRecoveryState(secretId);
		}
	});
});
