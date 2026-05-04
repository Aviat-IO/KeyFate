/**
 * NIP-65 relay preference helpers.
 *
 * KeyFate publishes NIP-59 gift wraps to a recipient's inbox/read relays when the
 * recipient has a NIP-65 kind 10002 relay list. Defaults are always appended so
 * disclosure delivery still has the existing broad fallback when no preference
 * event is found, the event is malformed, or discovery fails.
 */

import type { Event as NostrEvent } from 'nostr-tools/core';
import { createNostrClient } from './client';
import { DEFAULT_RELAYS } from './relay-config';

export const NIP65_RELAY_LIST_KIND = 10002;

type RelayListEvent = Pick<NostrEvent, 'kind' | 'pubkey' | 'created_at' | 'tags'>;

type QueryRelayList = (pubkey: string, relays: readonly string[]) => Promise<RelayListEvent | null>;

export interface ResolveRecipientInboxRelaysOptions {
	/** Relays to query for the recipient's NIP-65 kind 10002 event. */
	discoveryRelays?: readonly string[];
	/** Relays to append when recipient preferences are missing or incomplete. */
	fallbackRelays?: readonly string[];
	/** Test seam/custom lookup for NIP-65 relay-list events. */
	queryRelayList?: QueryRelayList;
}

function normalizeRelayUrl(url: string): string | null {
	const trimmed = url.trim();
	if (!trimmed) return null;

	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== 'wss:' && parsed.protocol !== 'ws:') return null;
		parsed.hash = '';
		parsed.search = '';
		return parsed.toString().replace(/\/$/, '');
	} catch {
		return null;
	}
}

function uniqueRelayUrls(relays: readonly string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const relay of relays) {
		const normalized = normalizeRelayUrl(relay);
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(normalized);
	}

	return result;
}

/**
 * Extract recipient inbox relays from a NIP-65 kind 10002 event.
 *
 * NIP-65 relay tags are `["r", "wss://relay.example", "read"|"write"]`.
 * For NIP-17/NIP-59 delivery, recipient inbox relays are read relays. Tags
 * without a marker are treated as both read and write. Write-only tags are not
 * inbox relays and are ignored.
 */
export function parseNip65InboxRelays(event: RelayListEvent | null | undefined): string[] {
	if (!event || event.kind !== NIP65_RELAY_LIST_KIND) return [];

	return uniqueRelayUrls(
		event.tags.flatMap((tag) => {
			if (tag[0] !== 'r' || !tag[1]) return [];
			const marker = tag[2];
			if (marker && marker !== 'read') return [];
			return [tag[1]];
		})
	);
}

/** Merge recipient-preferred relays before defaults, de-duped and normalized. */
export function mergeRecipientRelays(
	preferredRelays: readonly string[],
	fallbackRelays: readonly string[] = DEFAULT_RELAYS
): string[] {
	return uniqueRelayUrls([...preferredRelays, ...fallbackRelays]);
}

async function queryLatestNip65RelayList(
	pubkey: string,
	discoveryRelays: readonly string[]
): Promise<RelayListEvent | null> {
	const client = createNostrClient({ relays: [...discoveryRelays] });
	try {
		const events = await client.query({
			kinds: [NIP65_RELAY_LIST_KIND],
			authors: [pubkey],
			limit: 5
		});
		return (
			events
				.filter((event) => event.kind === NIP65_RELAY_LIST_KIND && event.pubkey === pubkey)
				.sort((a, b) => b.created_at - a.created_at)[0] ?? null
		);
	} finally {
		client.close();
	}
}

/**
 * Resolve relays for publishing a recipient gift wrap.
 *
 * Discovery failures are non-fatal: the returned relay list always includes the
 * fallback relay set, with any NIP-65 inbox/read relays prepended when found.
 */
export async function resolveRecipientInboxRelays(
	pubkey: string,
	options: ResolveRecipientInboxRelaysOptions = {}
): Promise<string[]> {
	const fallbackRelays = options.fallbackRelays ?? DEFAULT_RELAYS;
	const discoveryRelays = options.discoveryRelays ?? fallbackRelays;
	const queryRelayList = options.queryRelayList ?? queryLatestNip65RelayList;

	try {
		const relayListEvent = await queryRelayList(pubkey, discoveryRelays);
		const inboxRelays = parseNip65InboxRelays(relayListEvent);
		return mergeRecipientRelays(inboxRelays, fallbackRelays);
	} catch (err) {
		console.warn(
			`[NIP-65] Failed to discover recipient relays for ${pubkey.slice(0, 8)}...; ` +
				'using fallback relays',
			err
		);
		return mergeRecipientRelays([], fallbackRelays);
	}
}
