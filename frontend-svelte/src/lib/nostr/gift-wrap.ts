/**
 * NIP-59 Gift Wrap event construction.
 *
 * Implements the three-layer privacy protocol:
 *   1. Rumor  – unsigned event with the actual content
 *   2. Seal   – kind 13, signed by the real author, encrypts the rumor
 *   3. Gift Wrap – kind 1059, signed by a throwaway key, encrypts the seal
 *
 * The rumor for KeyFate carries a custom kind (21059) with share metadata.
 */

import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  getEventHash,
} from "nostr-tools/pure"
import type {
  UnsignedEvent,
  Event as NostrEvent,
  EventTemplate,
} from "nostr-tools/core"
import { getConversationKey, encrypt } from "./encryption"

/** Custom kind for KeyFate share delivery via Nostr. */
export const KEYFATE_SHARE_KIND = 21059

/** Two days in seconds – used to randomise timestamps. */
const TWO_DAYS_S = 2 * 24 * 60 * 60

/** Current unix timestamp in seconds. */
const now = () => Math.round(Date.now() / 1000)

/** A random timestamp within the last two days (prevents timing analysis). */
const randomNow = () => Math.round(now() - Math.random() * TWO_DAYS_S)

/** Payload embedded in the rumor's `content` field. */
export interface SharePayload {
  /** The double-encrypted share data */
  share: string
  /** KeyFate secret ID */
  secretId: string
  /** 1-based share index */
  shareIndex: number
  /** Minimum shares needed to reconstruct */
  threshold: number
  /** Total number of shares */
  totalShares: number
  /** Schema version */
  version: number
}

/** A rumor is an unsigned event with a computed id. */
export type Rumor = UnsignedEvent & { id: string }

/**
 * Build an unsigned rumor event for a KeyFate share.
 *
 * @param payload   - Share metadata
 * @param authorPubkey - Hex public key of the real author (KeyFate server key)
 */
export function createRumor(
  payload: SharePayload,
  authorPubkey: string,
): Rumor {
  const rumor: UnsignedEvent = {
    kind: KEYFATE_SHARE_KIND,
    created_at: now(),
    tags: [],
    content: JSON.stringify(payload),
    pubkey: authorPubkey,
  }

  const id = getEventHash(rumor)
  return { ...rumor, id }
}

/**
 * Wrap a rumor in a NIP-59 seal (kind 13).
 *
 * The seal is signed by the real author and encrypted to the recipient.
 *
 * @param rumor              - The unsigned rumor event
 * @param senderSecretKey    - Author's secret key (Uint8Array)
 * @param recipientPublicKey - Recipient's hex public key
 */
export function createSeal(
  rumor: Rumor,
  senderSecretKey: Uint8Array,
  recipientPublicKey: string,
): NostrEvent {
  const conversationKey = getConversationKey(senderSecretKey, recipientPublicKey)
  const encryptedRumor = encrypt(JSON.stringify(rumor), conversationKey)

  const sealTemplate: EventTemplate = {
    kind: 13,
    content: encryptedRumor,
    created_at: randomNow(),
    tags: [],
  }

  return finalizeEvent(sealTemplate, senderSecretKey) as NostrEvent
}

/**
 * Wrap a seal in a NIP-59 gift wrap (kind 1059).
 *
 * Uses a one-time-use ephemeral key so the outer event reveals nothing
 * about the real author.
 *
 * @param seal               - The signed seal event
 * @param recipientPublicKey - Recipient's hex public key (added as p-tag)
 */
export function createGiftWrap(
  seal: NostrEvent,
  recipientPublicKey: string,
): NostrEvent {
  const ephemeralKey = generateSecretKey()
  const conversationKey = getConversationKey(ephemeralKey, recipientPublicKey)
  const encryptedSeal = encrypt(JSON.stringify(seal), conversationKey)

  const wrapTemplate: EventTemplate = {
    kind: 1059,
    content: encryptedSeal,
    created_at: randomNow(),
    tags: [["p", recipientPublicKey]],
  }

  return finalizeEvent(wrapTemplate, ephemeralKey) as NostrEvent
}

/**
 * Full pipeline: build a gift-wrapped share event ready for publishing.
 *
 * @param payload            - Share data
 * @param senderSecretKey    - KeyFate server's secret key
 * @param recipientPublicKey - Recipient's hex public key
 */
export function wrapShareForRecipient(
  payload: SharePayload,
  senderSecretKey: Uint8Array,
  recipientPublicKey: string,
): NostrEvent {
  const senderPubkey = getPublicKey(senderSecretKey)
  const rumor = createRumor(payload, senderPubkey)
  const seal = createSeal(rumor, senderSecretKey, recipientPublicKey)
  return createGiftWrap(seal, recipientPublicKey)
}
