import type { Event as NostrEvent } from 'nostr-tools/core';
import { validateRecoveryShareEnvelopeContext } from '$lib/crypto/recovery-v3';

export interface SecretCreationRecipient {
	name: string;
	email: string;
	nostrPubkey: string;
}

export interface SecretCreationPayloadInput {
	title: string;
	serverShare: string;
	recipients: SecretCreationRecipient[];
	checkInDays: number;
	totalShares: number;
	threshold: number;
	enableNostrShares: boolean;
	enableBitcoinTimelock: boolean;
}

export function buildSecretCreationPayload(input: SecretCreationPayloadInput) {
	if (input.threshold !== 2) {
		throw new Error('Authenticated recovery currently requires a threshold of 2');
	}
	validateRecoveryShareEnvelopeContext(input.serverShare, {
		index: 1,
		threshold: input.threshold,
		total: input.totalShares
	});

	return {
		title: input.title,
		server_share: input.serverShare,
		recipients: input.recipients.map((recipient) => ({
			name: recipient.name,
			email: recipient.email
		})),
		check_in_days: input.checkInDays,
		sss_shares_total: input.totalShares,
		sss_threshold: input.threshold,
		enable_nostr_shares: input.enableNostrShares,
		enable_bitcoin_timelock: input.enableBitcoinTimelock,
		...(input.enableNostrShares
			? {
					recipient_nostr_pubkeys: input.recipients
						.filter((recipient) => recipient.nostrPubkey)
						.map((recipient) => ({
							email: recipient.email,
							npub: recipient.nostrPubkey
						}))
				}
			: {})
	};
}

export function buildNostrRegistrationPayload(
	published: Array<{
		giftWrapEvent: NostrEvent;
		capsuleEvent: NostrEvent;
		manifestEvent: NostrEvent;
	}>
): {
	artifacts: Array<{
		giftWrapEvent: NostrEvent;
		capsuleEvent: NostrEvent;
		manifestEvent: NostrEvent;
	}>;
} {
	return {
		artifacts: published.map(({ giftWrapEvent, capsuleEvent, manifestEvent }) => ({
			giftWrapEvent,
			capsuleEvent,
			manifestEvent
		}))
	};
}
