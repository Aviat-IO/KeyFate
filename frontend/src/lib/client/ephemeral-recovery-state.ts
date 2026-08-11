import type { Event as NostrEvent } from 'nostr-tools/core';
import type { RecoverySetupBundleV3 } from '$lib/nostr/recovery-v3-artifact';
import {
	MAX_RECOVERY_V3_TOTAL_SHARES,
	parseRecoveryShareEnvelope,
	validateRecoveryShareEnvelopeContext
} from '$lib/crypto/recovery-v3';

export interface EphemeralNostrArtifact {
	recipientId: string;
	recipientName: string;
	recipientEmail?: string | null;
	giftWrapEvent: NostrEvent;
	capsuleEvent: NostrEvent;
	manifestEvent: NostrEvent;
	setupBundle: RecoverySetupBundleV3;
	relayPublished: boolean;
}

export interface EphemeralNostrMetadata {
	eventIds: string[];
	manifests: NostrEvent[];
	setupBundles: RecoverySetupBundleV3[];
	artifacts: EphemeralNostrArtifact[];
}

export interface EphemeralBitcoinSetup {
	recipientId: string;
	recipientName: string;
	recipientNostrPubkey: string;
	nostrCapsuleEventId: string;
	nostrManifestEvent: NostrEvent;
	nostrCapsuleEvent: NostrEvent;
	plaintextK: Uint8Array;
}

export interface EphemeralRecoveryState {
	secretId: string;
	shares: string[];
	recipients: Array<{ name: string; email?: string | null }>;
	threshold: number;
	totalShares: number;
	createdAt: number;
	nostr?: EphemeralNostrMetadata;
	bitcoin?: EphemeralBitcoinSetup;
}

const MAX_AGE_MS = 30 * 60 * 1000;
const states = new Map<string, EphemeralRecoveryState>();
const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function destroyState(state: EphemeralRecoveryState): void {
	for (let index = 0; index < state.shares.length; index++) state.shares[index] = '';
	state.bitcoin?.plaintextK.fill(0);
}

function scheduleExpiry(secretId: string): void {
	const existing = expiryTimers.get(secretId);
	if (existing) clearTimeout(existing);
	const timer = setTimeout(() => clearEphemeralRecoveryState(secretId), MAX_AGE_MS);
	expiryTimers.set(secretId, timer);
}

export function partitionRecoveryShares(
	shares: string[],
	recipientCount: number
): { recipientShares: string[]; backupShares: string[] } {
	if (
		!Number.isInteger(recipientCount) ||
		recipientCount < 0 ||
		recipientCount > MAX_RECOVERY_V3_TOTAL_SHARES
	) {
		throw new Error('Recipient count must be a non-negative integer within the protocol maximum');
	}
	if (shares.length === 0) {
		if (recipientCount > 0) throw new Error('Shared recipient recovery envelope is missing');
		return { recipientShares: [], backupShares: [] };
	}
	if (shares.length > MAX_RECOVERY_V3_TOTAL_SHARES - 1) {
		throw new Error('Too many user-managed recovery envelopes');
	}

	const firstEnvelope = parseRecoveryShareEnvelope(shares[0]);
	const first = validateRecoveryShareEnvelopeContext(shares[0], {
		index: 2,
		threshold: firstEnvelope.threshold,
		total: firstEnvelope.total
	});
	if (first.total !== shares.length + 1) {
		throw new Error('User-managed recovery envelope count does not match declared total');
	}
	const protectedSecret = JSON.stringify(first.protectedSecret);
	for (let index = 0; index < shares.length; index += 1) {
		const envelope = validateRecoveryShareEnvelopeContext(shares[index], {
			index: index + 2,
			threshold: first.threshold,
			total: first.total
		});
		if (
			envelope.setId !== first.setId ||
			JSON.stringify(envelope.protectedSecret) !== protectedSecret
		) {
			throw new Error('User-managed recovery envelopes do not belong to one recovery set');
		}
	}

	return {
		recipientShares: recipientCount > 0 ? Array(recipientCount).fill(shares[0]) : [],
		backupShares: recipientCount > 0 ? shares.slice(1) : [...shares]
	};
}

export function buildSharedRecipientShareAssignments(
	recipientIds: string[],
	shares: string[]
): Array<{ recipientId: string; share: string; shareIndex: number }> {
	const { recipientShares } = partitionRecoveryShares(shares, recipientIds.length);
	return recipientIds.map((recipientId, index) => {
		const share = recipientShares[index];
		return {
			recipientId,
			share,
			shareIndex: parseRecoveryShareEnvelope(share).index
		};
	});
}

export function setEphemeralRecoveryState(state: EphemeralRecoveryState): void {
	const existing = states.get(state.secretId);
	if (existing && existing !== state) destroyState(existing);
	states.set(state.secretId, state);
	scheduleExpiry(state.secretId);
}

export function setEphemeralNostrMetadata(secretId: string, nostr: EphemeralNostrMetadata): void {
	const current = states.get(secretId);
	if (!current || Date.now() - current.createdAt > MAX_AGE_MS) {
		clearEphemeralRecoveryState(secretId);
		throw new Error('Ephemeral recovery state expired');
	}
	current.nostr = nostr;
}

export function setEphemeralBitcoinSetup(secretId: string, bitcoin: EphemeralBitcoinSetup): void {
	const current = states.get(secretId);
	if (!current || Date.now() - current.createdAt > MAX_AGE_MS) {
		clearEphemeralRecoveryState(secretId);
		bitcoin.plaintextK.fill(0);
		throw new Error('Ephemeral recovery state expired');
	}
	current.bitcoin = { ...bitcoin, plaintextK: Uint8Array.from(bitcoin.plaintextK) };
	bitcoin.plaintextK.fill(0);
}

export function getEphemeralRecoveryState(secretId: string): EphemeralRecoveryState | null {
	const state = states.get(secretId);
	if (!state) return null;
	if (Date.now() - state.createdAt > MAX_AGE_MS) {
		clearEphemeralRecoveryState(secretId);
		return null;
	}
	return state;
}

export function clearEphemeralRecoveryState(secretId: string): void {
	const timer = expiryTimers.get(secretId);
	if (timer) clearTimeout(timer);
	expiryTimers.delete(secretId);
	const state = states.get(secretId);
	if (state) destroyState(state);
	states.delete(secretId);
}
