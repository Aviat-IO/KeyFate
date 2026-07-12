import type { Event as NostrEvent } from 'nostr-tools/core';

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
	published: Array<{ giftWrapEvent: NostrEvent; manifestEvent: NostrEvent }>
): { artifacts: Array<{ giftWrapEvent: NostrEvent; manifestEvent: NostrEvent }> } {
	return {
		artifacts: published.map(({ giftWrapEvent, manifestEvent }) => ({
			giftWrapEvent,
			manifestEvent
		}))
	};
}
