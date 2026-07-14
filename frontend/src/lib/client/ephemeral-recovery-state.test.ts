import { describe, expect, it } from 'vitest';
import {
	clearEphemeralRecoveryState,
	getEphemeralRecoveryState,
	partitionRecoveryShares,
	setEphemeralBitcoinSetup,
	setEphemeralRecoveryState
} from './ephemeral-recovery-state';

describe('partitionRecoveryShares', () => {
	it('assigns one distinct generated share to each recipient', () => {
		const result = partitionRecoveryShares(['share-1', 'share-2', 'share-3'], 2);
		expect(result.recipientShares).toEqual(['share-1', 'share-2']);
		expect(new Set(result.recipientShares).size).toBe(2);
		expect(result.backupShares).toEqual(['share-3']);
	});
	it('does not classify assigned recipient shares as owner backups', () => {
		expect(partitionRecoveryShares(['share-1', 'share-2'], 2).backupShares).toEqual([]);
	});
	it('fails closed when there are more recipients than generated shares', () => {
		expect(() => partitionRecoveryShares(['share-1'], 2)).toThrow(
			'Recipient share count does not match'
		);
	});
	it('fails closed rather than assigning one share to multiple recipients', () => {
		expect(() => partitionRecoveryShares(['share-1', 'share-1'], 2)).toThrow(
			'Each recipient must be assigned a distinct recovery share'
		);
	});
});

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
		setEphemeralRecoveryState({ secretId, shares: ['share'], createdAt: Date.now() });
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
});
