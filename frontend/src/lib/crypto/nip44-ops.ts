/**
 * Default NIP-44 operations shared by double-encrypt and recovery modules.
 *
 * Uses the real nostr-tools NIP-44 v2 implementation via $lib/nostr/encryption.
 */

import type { Nip44Ops } from "./double-encrypt"
import {
  getConversationKey,
  encrypt as nip44Encrypt,
  decrypt as nip44Decrypt,
} from "$lib/nostr/encryption"

export const defaultNip44Ops: Nip44Ops = {
  encrypt(
    plaintext: string,
    senderPrivkey: Uint8Array,
    recipientPubkey: string,
  ): string {
    const convKey = getConversationKey(senderPrivkey, recipientPubkey)
    return nip44Encrypt(plaintext, convKey)
  },
  decrypt(
    ciphertext: string,
    recipientPrivkey: Uint8Array,
    senderPubkey: string,
  ): string {
    const convKey = getConversationKey(recipientPrivkey, senderPubkey)
    return nip44Decrypt(ciphertext, convKey)
  },
}
