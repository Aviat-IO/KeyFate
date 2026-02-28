/**
 * Tests for Nostr integration modules:
 *   - keypair generation and validation
 *   - NIP-44 encryption/decryption
 *   - NIP-59 gift wrap construction
 *   - relay config
 *   - client wrapper
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// keypair.ts
// ---------------------------------------------------------------------------
describe("Nostr Keypair", () => {
  it("generates a valid keypair with all fields", async () => {
    const { generateKeypair } = await import("$lib/nostr/keypair")
    const kp = generateKeypair()

    expect(kp.secretKey).toBeInstanceOf(Uint8Array)
    expect(kp.secretKey.length).toBe(32)
    expect(kp.publicKey).toMatch(/^[0-9a-f]{64}$/)
    expect(kp.npub).toMatch(/^npub1/)
    expect(kp.nsec).toMatch(/^nsec1/)
  })

  it("generates unique keypairs each call", async () => {
    const { generateKeypair } = await import("$lib/nostr/keypair")
    const a = generateKeypair()
    const b = generateKeypair()

    expect(a.publicKey).not.toBe(b.publicKey)
  })

  it("derives the correct public key from a secret key", async () => {
    const { generateKeypair, publicKeyFromSecret } = await import(
      "$lib/nostr/keypair"
    )
    const kp = generateKeypair()
    expect(publicKeyFromSecret(kp.secretKey)).toBe(kp.publicKey)
  })

  it("round-trips npub encoding", async () => {
    const { generateKeypair, npubToHex, hexToNpub } = await import(
      "$lib/nostr/keypair"
    )
    const kp = generateKeypair()

    expect(npubToHex(kp.npub)).toBe(kp.publicKey)
    expect(hexToNpub(kp.publicKey)).toBe(kp.npub)
  })

  it("npubToHex throws on invalid input", async () => {
    const { npubToHex } = await import("$lib/nostr/keypair")

    expect(() => npubToHex("not-an-npub")).toThrow()
  })

  it("npubToHex throws when given an nsec", async () => {
    const { npubToHex, generateKeypair } = await import("$lib/nostr/keypair")
    const kp = generateKeypair()

    expect(() => npubToHex(kp.nsec)).toThrow("Expected npub")
  })

  describe("isValidNpub", () => {
    it("returns true for a valid npub", async () => {
      const { isValidNpub, generateKeypair } = await import(
        "$lib/nostr/keypair"
      )
      const kp = generateKeypair()
      expect(isValidNpub(kp.npub)).toBe(true)
    })

    it("returns false for garbage", async () => {
      const { isValidNpub } = await import("$lib/nostr/keypair")
      expect(isValidNpub("garbage")).toBe(false)
      expect(isValidNpub("")).toBe(false)
      expect(isValidNpub("npub1xyz")).toBe(false)
    })
  })

  describe("isValidHexPubkey", () => {
    it("returns true for a 64-char hex string", async () => {
      const { isValidHexPubkey, generateKeypair } = await import(
        "$lib/nostr/keypair"
      )
      const kp = generateKeypair()
      expect(isValidHexPubkey(kp.publicKey)).toBe(true)
    })

    it("returns false for wrong length or uppercase", async () => {
      const { isValidHexPubkey } = await import("$lib/nostr/keypair")
      expect(isValidHexPubkey("abc")).toBe(false)
      expect(isValidHexPubkey("A".repeat(64))).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// encryption.ts (NIP-44)
// ---------------------------------------------------------------------------
describe("Nostr NIP-44 Encryption", () => {
  it("encrypts and decrypts a message between two keypairs", async () => {
    const { generateKeypair } = await import("$lib/nostr/keypair")
    const { getConversationKey, encrypt, decrypt } = await import(
      "$lib/nostr/encryption"
    )

    const sender = generateKeypair()
    const recipient = generateKeypair()

    const convKey = getConversationKey(sender.secretKey, recipient.publicKey)
    const plaintext = "Hello from KeyFate!"
    const ciphertext = encrypt(plaintext, convKey)

    expect(ciphertext).not.toBe(plaintext)
    expect(typeof ciphertext).toBe("string")

    // Recipient derives the same conversation key
    const recipientConvKey = getConversationKey(
      recipient.secretKey,
      sender.publicKey,
    )
    const decrypted = decrypt(ciphertext, recipientConvKey)
    expect(decrypted).toBe(plaintext)
  })

  it("conversation key is symmetric", async () => {
    const { generateKeypair } = await import("$lib/nostr/keypair")
    const { getConversationKey } = await import("$lib/nostr/encryption")

    const a = generateKeypair()
    const b = generateKeypair()

    const keyAB = getConversationKey(a.secretKey, b.publicKey)
    const keyBA = getConversationKey(b.secretKey, a.publicKey)

    expect(Buffer.from(keyAB).toString("hex")).toBe(
      Buffer.from(keyBA).toString("hex"),
    )
  })

  it("produces different ciphertext for the same plaintext", async () => {
    const { generateKeypair } = await import("$lib/nostr/keypair")
    const { getConversationKey, encrypt } = await import(
      "$lib/nostr/encryption"
    )

    const sender = generateKeypair()
    const recipient = generateKeypair()
    const convKey = getConversationKey(sender.secretKey, recipient.publicKey)

    const c1 = encrypt("same message", convKey)
    const c2 = encrypt("same message", convKey)

    // NIP-44 uses a random nonce each time
    expect(c1).not.toBe(c2)
  })

  it("decryption fails with wrong key", async () => {
    const { generateKeypair } = await import("$lib/nostr/keypair")
    const { getConversationKey, encrypt, decrypt } = await import(
      "$lib/nostr/encryption"
    )

    const sender = generateKeypair()
    const recipient = generateKeypair()
    const wrongRecipient = generateKeypair()

    const convKey = getConversationKey(sender.secretKey, recipient.publicKey)
    const ciphertext = encrypt("secret", convKey)

    const wrongKey = getConversationKey(
      wrongRecipient.secretKey,
      sender.publicKey,
    )
    expect(() => decrypt(ciphertext, wrongKey)).toThrow()
  })

  it("handles unicode content", async () => {
    const { generateKeypair } = await import("$lib/nostr/keypair")
    const { getConversationKey, encrypt, decrypt } = await import(
      "$lib/nostr/encryption"
    )

    const sender = generateKeypair()
    const recipient = generateKeypair()
    const convKey = getConversationKey(sender.secretKey, recipient.publicKey)

    const msg = "Emoji: \u{1F512}\u{1F511} CJK: \u4F60\u597D"
    const decrypted = decrypt(encrypt(msg, convKey), convKey)
    expect(decrypted).toBe(msg)
  })

  it("handles JSON payloads", async () => {
    const { generateKeypair } = await import("$lib/nostr/keypair")
    const { getConversationKey, encrypt, decrypt } = await import(
      "$lib/nostr/encryption"
    )

    const sender = generateKeypair()
    const recipient = generateKeypair()
    const convKey = getConversationKey(sender.secretKey, recipient.publicKey)

    const payload = JSON.stringify({
      share: "abc123",
      secretId: "uuid-here",
      shareIndex: 1,
      threshold: 2,
      totalShares: 3,
    })

    const decrypted = decrypt(encrypt(payload, convKey), convKey)
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(payload))
  })
})

// ---------------------------------------------------------------------------
// gift-wrap.ts (NIP-59)
// ---------------------------------------------------------------------------
describe("Nostr NIP-59 Gift Wrap", () => {
  it("createRumor produces an unsigned event with correct kind", async () => {
    const { generateKeypair } = await import("$lib/nostr/keypair")
    const { createRumor, KEYFATE_SHARE_KIND } = await import(
      "$lib/nostr/gift-wrap"
    )

    const kp = generateKeypair()
    const rumor = createRumor(
      {
        share: "share-data",
        secretId: "secret-123",
        shareIndex: 1,
        threshold: 2,
        totalShares: 3,
        version: 1,
      },
      kp.publicKey,
    )

    expect(rumor.kind).toBe(KEYFATE_SHARE_KIND)
    expect(rumor.pubkey).toBe(kp.publicKey)
    expect(rumor.id).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.parse(rumor.content)).toEqual({
      share: "share-data",
      secretId: "secret-123",
      shareIndex: 1,
      threshold: 2,
      totalShares: 3,
      version: 1,
    })
    // Rumor must NOT have a signature
    expect((rumor as any).sig).toBeUndefined()
  })

  it("createSeal produces a kind 13 signed event", async () => {
    const { generateKeypair } = await import("$lib/nostr/keypair")
    const { createRumor, createSeal } = await import("$lib/nostr/gift-wrap")

    const sender = generateKeypair()
    const recipient = generateKeypair()

    const rumor = createRumor(
      {
        share: "data",
        secretId: "s1",
        shareIndex: 1,
        threshold: 2,
        totalShares: 3,
        version: 1,
      },
      sender.publicKey,
    )

    const seal = createSeal(rumor, sender.secretKey, recipient.publicKey)

    expect(seal.kind).toBe(13)
    expect(seal.pubkey).toBe(sender.publicKey)
    expect(seal.sig).toMatch(/^[0-9a-f]+$/)
    expect(seal.tags).toEqual([])
    // Content is NIP-44 encrypted (base64), not the raw rumor JSON
    expect(seal.content).not.toContain("share-data")
    expect(seal.content.length).toBeGreaterThan(0)
  })

  it("createGiftWrap produces a kind 1059 event with p-tag", async () => {
    const { generateKeypair } = await import("$lib/nostr/keypair")
    const { createRumor, createSeal, createGiftWrap } = await import(
      "$lib/nostr/gift-wrap"
    )

    const sender = generateKeypair()
    const recipient = generateKeypair()

    const rumor = createRumor(
      {
        share: "data",
        secretId: "s1",
        shareIndex: 1,
        threshold: 2,
        totalShares: 3,
        version: 1,
      },
      sender.publicKey,
    )

    const seal = createSeal(rumor, sender.secretKey, recipient.publicKey)
    const wrap = createGiftWrap(seal, recipient.publicKey)

    expect(wrap.kind).toBe(1059)
    expect(wrap.tags).toEqual([["p", recipient.publicKey]])
    expect(wrap.sig).toMatch(/^[0-9a-f]+$/)
    // The pubkey should be an ephemeral key, NOT the sender's
    expect(wrap.pubkey).not.toBe(sender.publicKey)
    expect(wrap.pubkey).toMatch(/^[0-9a-f]{64}$/)
  })

  it("wrapShareForRecipient produces a complete gift wrap", async () => {
    const { generateKeypair } = await import("$lib/nostr/keypair")
    const { wrapShareForRecipient } = await import("$lib/nostr/gift-wrap")

    const sender = generateKeypair()
    const recipient = generateKeypair()

    const wrap = wrapShareForRecipient(
      {
        share: "encrypted-share-data",
        secretId: "secret-uuid",
        shareIndex: 2,
        threshold: 2,
        totalShares: 3,
        version: 1,
      },
      sender.secretKey,
      recipient.publicKey,
    )

    expect(wrap.kind).toBe(1059)
    expect(wrap.tags).toEqual([["p", recipient.publicKey]])
    expect(wrap.pubkey).not.toBe(sender.publicKey)
    expect(wrap.id).toMatch(/^[0-9a-f]{64}$/)
    expect(wrap.sig).toMatch(/^[0-9a-f]+$/)
  })

  it("recipient can unwrap the gift wrap to recover the share payload", async () => {
    const { generateKeypair } = await import("$lib/nostr/keypair")
    const { wrapShareForRecipient } = await import("$lib/nostr/gift-wrap")
    const { getConversationKey, decrypt } = await import(
      "$lib/nostr/encryption"
    )

    const sender = generateKeypair()
    const recipient = generateKeypair()

    const originalPayload = {
      share: "the-actual-share",
      secretId: "secret-uuid",
      shareIndex: 1,
      threshold: 2,
      totalShares: 3,
      version: 1,
    }

    const wrap = wrapShareForRecipient(
      originalPayload,
      sender.secretKey,
      recipient.publicKey,
    )

    // Step 1: Recipient decrypts the gift wrap to get the seal
    const wrapConvKey = getConversationKey(
      recipient.secretKey,
      wrap.pubkey, // ephemeral pubkey
    )
    const sealJson = decrypt(wrap.content, wrapConvKey)
    const seal = JSON.parse(sealJson)

    expect(seal.kind).toBe(13)
    expect(seal.pubkey).toBe(sender.publicKey)

    // Step 2: Recipient decrypts the seal to get the rumor
    const sealConvKey = getConversationKey(
      recipient.secretKey,
      seal.pubkey, // sender's real pubkey
    )
    const rumorJson = decrypt(seal.content, sealConvKey)
    const rumor = JSON.parse(rumorJson)

    expect(rumor.kind).toBe(21059)
    expect(JSON.parse(rumor.content)).toEqual(originalPayload)
  })

  it("different recipients get different gift wraps for the same payload", async () => {
    const { generateKeypair } = await import("$lib/nostr/keypair")
    const { wrapShareForRecipient } = await import("$lib/nostr/gift-wrap")

    const sender = generateKeypair()
    const r1 = generateKeypair()
    const r2 = generateKeypair()

    const payload = {
      share: "share",
      secretId: "s",
      shareIndex: 1,
      threshold: 2,
      totalShares: 3,
      version: 1,
    }

    const w1 = wrapShareForRecipient(payload, sender.secretKey, r1.publicKey)
    const w2 = wrapShareForRecipient(payload, sender.secretKey, r2.publicKey)

    // Different ephemeral keys, different content
    expect(w1.pubkey).not.toBe(w2.pubkey)
    expect(w1.content).not.toBe(w2.content)
    expect(w1.id).not.toBe(w2.id)
  })
})

// ---------------------------------------------------------------------------
// relay-config.ts
// ---------------------------------------------------------------------------
describe("Nostr Relay Config", () => {
  it("exports a non-empty default relay list", async () => {
    const { DEFAULT_RELAYS } = await import("$lib/nostr/relay-config")
    expect(DEFAULT_RELAYS.length).toBeGreaterThan(0)
    for (const url of DEFAULT_RELAYS) {
      expect(url).toMatch(/^wss:\/\//)
    }
  })

  it("checkRelayHealth returns unhealthy for invalid URL", async () => {
    const { checkRelayHealth } = await import("$lib/nostr/relay-config")

    // In jsdom, WebSocket to a non-existent host will fail
    const result = await checkRelayHealth("wss://localhost:1")
    expect(result.url).toBe("wss://localhost:1")
    expect(result.healthy).toBe(false)
    expect(result.lastChecked).toBeInstanceOf(Date)
  })
})

// ---------------------------------------------------------------------------
// client.ts
// ---------------------------------------------------------------------------
describe("Nostr Client", () => {
  it("creates a client with default relays", async () => {
    const { NostrClient } = await import("$lib/nostr/client")
    const { DEFAULT_RELAYS } = await import("$lib/nostr/relay-config")

    const client = new NostrClient()
    expect(client.getRelays()).toEqual(DEFAULT_RELAYS)
    client.close()
  })

  it("creates a client with custom relays", async () => {
    const { NostrClient } = await import("$lib/nostr/client")

    const relays = ["wss://custom.relay"]
    const client = new NostrClient({ relays })
    expect(client.getRelays()).toEqual(relays)
    client.close()
  })

  it("setRelays updates the relay list", async () => {
    const { NostrClient } = await import("$lib/nostr/client")

    const client = new NostrClient()
    const newRelays = ["wss://new.relay"]
    client.setRelays(newRelays)
    expect(client.getRelays()).toEqual(newRelays)
    client.close()
  })

  it("createNostrClient factory returns a NostrClient", async () => {
    const { createNostrClient, NostrClient } = await import(
      "$lib/nostr/client"
    )

    const client = createNostrClient({ relays: ["wss://test.relay"] })
    expect(client).toBeInstanceOf(NostrClient)
    client.close()
  })
})
