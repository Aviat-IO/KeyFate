/**
 * Tests for client-side Bitcoin wallet (key generation and session storage).
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { secp256k1 } from "@noble/curves/secp256k1.js"

describe("Client Wallet - generateBitcoinKeypair", () => {
  it("generates a keypair with 32-byte private key", async () => {
    const { generateBitcoinKeypair } = await import("$lib/bitcoin/client-wallet")
    const keypair = generateBitcoinKeypair()
    expect(keypair.privkey).toBeInstanceOf(Uint8Array)
    expect(keypair.privkey.length).toBe(32)
  })

  it("generates a keypair with 33-byte compressed public key", async () => {
    const { generateBitcoinKeypair } = await import("$lib/bitcoin/client-wallet")
    const keypair = generateBitcoinKeypair()
    expect(keypair.pubkey).toBeInstanceOf(Uint8Array)
    expect(keypair.pubkey.length).toBe(33)
  })

  it("generates a valid secp256k1 public key matching the private key", async () => {
    const { generateBitcoinKeypair } = await import("$lib/bitcoin/client-wallet")
    const keypair = generateBitcoinKeypair()

    // Independently derive pubkey from privkey and compare
    const expectedPubkey = secp256k1.getPublicKey(keypair.privkey, true)
    expect(Array.from(keypair.pubkey)).toEqual(Array.from(expectedPubkey))
  })

  it("generates unique keypairs on each call", async () => {
    const { generateBitcoinKeypair } = await import("$lib/bitcoin/client-wallet")
    const kp1 = generateBitcoinKeypair()
    const kp2 = generateBitcoinKeypair()

    // Private keys should differ (astronomically unlikely to collide)
    expect(Array.from(kp1.privkey)).not.toEqual(Array.from(kp2.privkey))
    expect(Array.from(kp1.pubkey)).not.toEqual(Array.from(kp2.pubkey))
  })

  it("produces a pubkey starting with 0x02 or 0x03 (compressed)", async () => {
    const { generateBitcoinKeypair } = await import("$lib/bitcoin/client-wallet")
    const keypair = generateBitcoinKeypair()
    expect([0x02, 0x03]).toContain(keypair.pubkey[0])
  })
})

describe("Client Wallet - sessionStorage operations", () => {
  let mockStorage: Map<string, string>

  beforeEach(() => {
    mockStorage = new Map()
    // Mock sessionStorage for test environment
    globalThis.sessionStorage = {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, value: string) => { mockStorage.set(key, value) },
      removeItem: (key: string) => { mockStorage.delete(key) },
      clear: () => { mockStorage.clear() },
      get length() { return mockStorage.size },
      key: (index: number) => Array.from(mockStorage.keys())[index] ?? null,
    } as Storage
  })

  it("stores and retrieves a keypair by secretId and role", async () => {
    const { generateBitcoinKeypair, storeKeypair, getStoredKeypair } = await import(
      "$lib/bitcoin/client-wallet"
    )
    const keypair = generateBitcoinKeypair()

    storeKeypair("secret-123", "owner", keypair)
    const retrieved = getStoredKeypair("secret-123", "owner")

    expect(retrieved).not.toBeNull()
    expect(Array.from(retrieved!.privkey)).toEqual(Array.from(keypair.privkey))
    expect(Array.from(retrieved!.pubkey)).toEqual(Array.from(keypair.pubkey))
  })

  it("returns null for non-existent keypair", async () => {
    const { getStoredKeypair } = await import("$lib/bitcoin/client-wallet")
    const result = getStoredKeypair("nonexistent", "owner")
    expect(result).toBeNull()
  })

  it("stores owner and recipient keypairs separately", async () => {
    const { generateBitcoinKeypair, storeKeypair, getStoredKeypair } = await import(
      "$lib/bitcoin/client-wallet"
    )
    const ownerKp = generateBitcoinKeypair()
    const recipientKp = generateBitcoinKeypair()

    storeKeypair("secret-456", "owner", ownerKp)
    storeKeypair("secret-456", "recipient", recipientKp)

    const retrievedOwner = getStoredKeypair("secret-456", "owner")
    const retrievedRecipient = getStoredKeypair("secret-456", "recipient")

    expect(retrievedOwner).not.toBeNull()
    expect(retrievedRecipient).not.toBeNull()
    expect(Array.from(retrievedOwner!.privkey)).toEqual(Array.from(ownerKp.privkey))
    expect(Array.from(retrievedRecipient!.privkey)).toEqual(Array.from(recipientKp.privkey))
  })

  it("clears keypairs for a specific secret", async () => {
    const { generateBitcoinKeypair, storeKeypair, getStoredKeypair, clearKeypairs } = await import(
      "$lib/bitcoin/client-wallet"
    )
    const kp = generateBitcoinKeypair()

    storeKeypair("secret-789", "owner", kp)
    storeKeypair("secret-789", "recipient", kp)

    clearKeypairs("secret-789")

    expect(getStoredKeypair("secret-789", "owner")).toBeNull()
    expect(getStoredKeypair("secret-789", "recipient")).toBeNull()
  })

  it("does not clear keypairs for other secrets", async () => {
    const { generateBitcoinKeypair, storeKeypair, getStoredKeypair, clearKeypairs } = await import(
      "$lib/bitcoin/client-wallet"
    )
    const kp1 = generateBitcoinKeypair()
    const kp2 = generateBitcoinKeypair()

    storeKeypair("secret-A", "owner", kp1)
    storeKeypair("secret-B", "owner", kp2)

    clearKeypairs("secret-A")

    expect(getStoredKeypair("secret-A", "owner")).toBeNull()
    expect(getStoredKeypair("secret-B", "owner")).not.toBeNull()
  })

  it("retrieved keypair has correct byte lengths", async () => {
    const { generateBitcoinKeypair, storeKeypair, getStoredKeypair } = await import(
      "$lib/bitcoin/client-wallet"
    )
    const keypair = generateBitcoinKeypair()
    storeKeypair("secret-len", "owner", keypair)

    const retrieved = getStoredKeypair("secret-len", "owner")
    expect(retrieved).not.toBeNull()
    expect(retrieved!.privkey.length).toBe(32)
    expect(retrieved!.pubkey.length).toBe(33)
  })
})
