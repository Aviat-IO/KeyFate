import type { Event as NostrEvent } from 'nostr-tools/core';

export interface EphemeralNostrMetadata {
	eventIds: string[];
	manifests: NostrEvent[];
}

export interface EphemeralRecoveryState {
	secretId: string;
	shares: string[];
	createdAt: number;
	nostr?: EphemeralNostrMetadata;
}

const MAX_AGE_MS = 30 * 60 * 1000;
const states = new Map<string, EphemeralRecoveryState>();

export function partitionRecoveryShares(
	shares: string[],
	recipientCount: number
): { recipientShares: string[]; backupShares: string[] } {
	if (!Number.isInteger(recipientCount) || recipientCount < 0 || recipientCount > shares.length) {
		throw new Error('Recipient share count does not match the generated recovery shares');
	}
	const recipientShares = shares.slice(0, recipientCount);
	if (new Set(recipientShares).size !== recipientShares.length) {
		throw new Error('Each recipient must be assigned a distinct recovery share');
	}
	return {
		recipientShares,
		backupShares: shares.slice(recipientCount)
	};
}

export function setEphemeralRecoveryState(state: EphemeralRecoveryState): void {
	states.set(state.secretId, structuredClone(state));
}

export function setEphemeralNostrMetadata(secretId: string, nostr: EphemeralNostrMetadata): void {
	const current = getEphemeralRecoveryState(secretId);
	if (!current) throw new Error('Ephemeral recovery state expired');
	states.set(secretId, structuredClone({ ...current, nostr }));
}

export function getEphemeralRecoveryState(secretId: string): EphemeralRecoveryState | null {
	const state = states.get(secretId);
	if (!state) return null;
	if (Date.now() - state.createdAt > MAX_AGE_MS) {
		clearEphemeralRecoveryState(secretId);
		return null;
	}
	return structuredClone(state);
}

export function clearEphemeralRecoveryState(secretId: string): void {
	const state = states.get(secretId);
	if (state) {
		for (let index = 0; index < state.shares.length; index++) state.shares[index] = '';
	}
	states.delete(secretId);
}
