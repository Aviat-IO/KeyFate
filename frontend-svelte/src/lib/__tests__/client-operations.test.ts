/**
 * Tests for client-side Bitcoin operations (enableBitcoinClient, refreshBitcoinClient).
 *
 * These test the full client-side flow: create timelock UTXO, broadcast, create pre-signed tx.
 * Broadcast is mocked (no real network calls).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { secp256k1 } from "@noble/curves/secp256k1.js"
import { hex } from "@scure/base"
import * as btc from "@scure/btc-signer"

// ─── Test key pairs ───────────────────────────────────────────────────────────

function makeKeyPair(seed: number) {
  const privkey = new Uint8Array(32)
  privkey[31] = seed
  const pubkey = secp256k1.getPublicKey(privkey, true)
  return { privkey, pubkey }
}

const owner = makeKeyPair(1)
const recipient = makeKeyPair(2)

// ─── enableBitcoinClient tests ────────────────────────────────────────────────

describe("Client Operations - enableBitcoinClient", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("creates timelock UTXO, broadcasts, and returns result", async () => {
    const { enableBitcoinClient } = await import("$lib/bitcoin/client-operations")

    // Mock broadcast to return a fake txId
    const fakeBroadcastTxId = "ab".repeat(32)
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => fakeBroadcastTxId,
    }) as unknown as typeof fetch

    const ownerP2wpkh = btc.p2wpkh(owner.pubkey, btc.TEST_NETWORK)
    const recipientP2wpkh = btc.p2wpkh(recipient.pubkey, btc.TEST_NETWORK)

    const result = await enableBitcoinClient({
      ownerKeypair: owner,
      recipientKeypair: recipient,
      fundingUtxo: {
        txId: "cc".repeat(32),
        outputIndex: 0,
        amountSats: 100000,
        scriptPubKey: hex.encode(ownerP2wpkh.script),
      },
      amountSats: 50000,
      feeRateSatsPerVbyte: 10,
      symmetricKeyK: new Uint8Array(32).fill(0xaa),
      nostrEventId: "dd".repeat(32),
      recipientAddress: recipientP2wpkh.address!,
      ttlBlocks: 144,
      network: "testnet",
    })

    expect(result.txId).toBe(fakeBroadcastTxId)
    expect(result.outputIndex).toBe(0)
    expect(result.timelockScript).toBeInstanceOf(Uint8Array)
    expect(result.timelockScript.length).toBeGreaterThan(0)
    expect(result.preSignedRecipientTx).toBeTruthy()
    expect(typeof result.preSignedRecipientTx).toBe("string")
    expect(Array.from(result.ownerPubkey)).toEqual(Array.from(owner.pubkey))
    expect(Array.from(result.recipientPubkey)).toEqual(Array.from(recipient.pubkey))

    // Verify broadcast was called
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    expect(mockFetch).toHaveBeenCalledTimes(1)

    globalThis.fetch = originalFetch
  })

  it("pre-signed tx contains OP_RETURN with symmetric key", async () => {
    const { enableBitcoinClient } = await import("$lib/bitcoin/client-operations")

    const fakeTxId = "ee".repeat(32)
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => fakeTxId,
    }) as unknown as typeof fetch

    const ownerP2wpkh = btc.p2wpkh(owner.pubkey, btc.TEST_NETWORK)
    const recipientP2wpkh = btc.p2wpkh(recipient.pubkey, btc.TEST_NETWORK)

    const result = await enableBitcoinClient({
      ownerKeypair: owner,
      recipientKeypair: recipient,
      fundingUtxo: {
        txId: "ff".repeat(32),
        outputIndex: 0,
        amountSats: 100000,
        scriptPubKey: hex.encode(ownerP2wpkh.script),
      },
      amountSats: 50000,
      feeRateSatsPerVbyte: 5,
      symmetricKeyK: new Uint8Array(32).fill(0xbb),
      nostrEventId: "aa".repeat(32),
      recipientAddress: recipientP2wpkh.address!,
      ttlBlocks: 4320,
      network: "testnet",
    })

    // Decode the pre-signed tx and verify OP_RETURN
    const rawTx = btc.RawTx.decode(hex.decode(result.preSignedRecipientTx))
    expect(rawTx.outputs.length).toBe(2) // OP_RETURN + recipient
    expect(rawTx.outputs[0].amount).toBe(0n)
    expect(rawTx.outputs[0].script[0]).toBe(0x6a) // OP_RETURN

    globalThis.fetch = originalFetch
  })

  it("throws when broadcast fails", async () => {
    const { enableBitcoinClient } = await import("$lib/bitcoin/client-operations")

    // Mock all broadcast endpoints to fail
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Server error",
    }) as unknown as typeof fetch

    const ownerP2wpkh = btc.p2wpkh(owner.pubkey, btc.TEST_NETWORK)
    const recipientP2wpkh = btc.p2wpkh(recipient.pubkey, btc.TEST_NETWORK)

    await expect(
      enableBitcoinClient({
        ownerKeypair: owner,
        recipientKeypair: recipient,
        fundingUtxo: {
          txId: "aa".repeat(32),
          outputIndex: 0,
          amountSats: 100000,
          scriptPubKey: hex.encode(ownerP2wpkh.script),
        },
        amountSats: 50000,
        feeRateSatsPerVbyte: 10,
        symmetricKeyK: new Uint8Array(32).fill(0xcc),
        nostrEventId: "dd".repeat(32),
        recipientAddress: recipientP2wpkh.address!,
        ttlBlocks: 144,
        network: "testnet",
      }),
    ).rejects.toThrow("Failed to broadcast")

    globalThis.fetch = originalFetch
  })

  it("timelockScript can be decoded to verify owner/recipient pubkeys", async () => {
    const { enableBitcoinClient } = await import("$lib/bitcoin/client-operations")
    const { decodeCSVTimelockScript } = await import("$lib/bitcoin/script")

    const fakeTxId = "11".repeat(32)
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => fakeTxId,
    }) as unknown as typeof fetch

    const ownerP2wpkh = btc.p2wpkh(owner.pubkey, btc.TEST_NETWORK)
    const recipientP2wpkh = btc.p2wpkh(recipient.pubkey, btc.TEST_NETWORK)

    const result = await enableBitcoinClient({
      ownerKeypair: owner,
      recipientKeypair: recipient,
      fundingUtxo: {
        txId: "22".repeat(32),
        outputIndex: 0,
        amountSats: 100000,
        scriptPubKey: hex.encode(ownerP2wpkh.script),
      },
      amountSats: 50000,
      feeRateSatsPerVbyte: 10,
      symmetricKeyK: new Uint8Array(32).fill(0xdd),
      nostrEventId: "ee".repeat(32),
      recipientAddress: recipientP2wpkh.address!,
      ttlBlocks: 288,
      network: "testnet",
    })

    const decoded = decodeCSVTimelockScript(result.timelockScript)
    expect(decoded.ttlBlocks).toBe(288)
    expect(hex.encode(decoded.ownerPubkey)).toBe(hex.encode(owner.pubkey))
    expect(hex.encode(decoded.recipientPubkey)).toBe(hex.encode(recipient.pubkey))

    globalThis.fetch = originalFetch
  })
})

// ─── refreshBitcoinClient tests ───────────────────────────────────────────────

describe("Client Operations - refreshBitcoinClient", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("refreshes a timelock UTXO and returns new UTXO data", async () => {
    const { refreshBitcoinClient } = await import("$lib/bitcoin/client-operations")
    const { createCSVTimelockScript } = await import("$lib/bitcoin/script")

    const currentScript = createCSVTimelockScript(owner.pubkey, recipient.pubkey, 144)

    const fakeBroadcastTxId = "bb".repeat(32)
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => fakeBroadcastTxId,
    }) as unknown as typeof fetch

    const recipientP2wpkh = btc.p2wpkh(recipient.pubkey, btc.TEST_NETWORK)

    const result = await refreshBitcoinClient({
      ownerKeypair: owner,
      recipientPubkey: recipient.pubkey,
      currentUtxo: {
        txId: "aa".repeat(32),
        outputIndex: 0,
        amountSats: 50000,
      },
      currentScript,
      ttlBlocks: 144,
      feeRateSatsPerVbyte: 10,
      symmetricKeyK: new Uint8Array(32).fill(0xaa),
      nostrEventId: "dd".repeat(32),
      recipientPrivkey: recipient.privkey,
      recipientAddress: recipientP2wpkh.address!,
      network: "testnet",
    })

    expect(result.newTxId).toBe(fakeBroadcastTxId)
    expect(result.newOutputIndex).toBe(0)
    expect(result.newTimelockScript).toBeInstanceOf(Uint8Array)
    expect(result.newAmountSats).toBeLessThan(50000)
    expect(result.newAmountSats).toBeGreaterThan(0)
    expect(result.preSignedRecipientTx).toBeTruthy()

    // Verify broadcast was called
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    expect(mockFetch).toHaveBeenCalledTimes(1)

    globalThis.fetch = originalFetch
  })

  it("new UTXO has reduced amount (fee deducted)", async () => {
    const { refreshBitcoinClient } = await import("$lib/bitcoin/client-operations")
    const { createCSVTimelockScript } = await import("$lib/bitcoin/script")

    const currentScript = createCSVTimelockScript(owner.pubkey, recipient.pubkey, 144)

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => "cc".repeat(32),
    }) as unknown as typeof fetch

    const recipientP2wpkh = btc.p2wpkh(recipient.pubkey, btc.TEST_NETWORK)

    const result = await refreshBitcoinClient({
      ownerKeypair: owner,
      recipientPubkey: recipient.pubkey,
      currentUtxo: {
        txId: "dd".repeat(32),
        outputIndex: 0,
        amountSats: 50000,
      },
      currentScript,
      ttlBlocks: 144,
      feeRateSatsPerVbyte: 5,
      symmetricKeyK: new Uint8Array(32).fill(0xee),
      nostrEventId: "ff".repeat(32),
      recipientPrivkey: recipient.privkey,
      recipientAddress: recipientP2wpkh.address!,
      network: "testnet",
    })

    // Fee at 5 sat/vbyte * ~204 vbytes = ~1020 sats
    expect(result.newAmountSats).toBeLessThan(50000)
    expect(result.newAmountSats).toBeGreaterThan(48000)

    globalThis.fetch = originalFetch
  })

  it("throws when broadcast fails during refresh", async () => {
    const { refreshBitcoinClient } = await import("$lib/bitcoin/client-operations")
    const { createCSVTimelockScript } = await import("$lib/bitcoin/script")

    const currentScript = createCSVTimelockScript(owner.pubkey, recipient.pubkey, 144)

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Error",
    }) as unknown as typeof fetch

    const recipientP2wpkh = btc.p2wpkh(recipient.pubkey, btc.TEST_NETWORK)

    await expect(
      refreshBitcoinClient({
        ownerKeypair: owner,
        recipientPubkey: recipient.pubkey,
        currentUtxo: {
          txId: "aa".repeat(32),
          outputIndex: 0,
          amountSats: 50000,
        },
        currentScript,
        ttlBlocks: 144,
        feeRateSatsPerVbyte: 10,
        symmetricKeyK: new Uint8Array(32).fill(0xaa),
        nostrEventId: "bb".repeat(32),
        recipientPrivkey: recipient.privkey,
        recipientAddress: recipientP2wpkh.address!,
        network: "testnet",
      }),
    ).rejects.toThrow("Failed to broadcast")

    globalThis.fetch = originalFetch
  })

  it("new timelock script has correct TTL", async () => {
    const { refreshBitcoinClient } = await import("$lib/bitcoin/client-operations")
    const { createCSVTimelockScript, decodeCSVTimelockScript } = await import(
      "$lib/bitcoin/script"
    )

    const currentScript = createCSVTimelockScript(owner.pubkey, recipient.pubkey, 144)

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => "ee".repeat(32),
    }) as unknown as typeof fetch

    const recipientP2wpkh = btc.p2wpkh(recipient.pubkey, btc.TEST_NETWORK)

    const result = await refreshBitcoinClient({
      ownerKeypair: owner,
      recipientPubkey: recipient.pubkey,
      currentUtxo: {
        txId: "ff".repeat(32),
        outputIndex: 0,
        amountSats: 50000,
      },
      currentScript,
      ttlBlocks: 288, // Different TTL
      feeRateSatsPerVbyte: 10,
      symmetricKeyK: new Uint8Array(32).fill(0x11),
      nostrEventId: "22".repeat(32),
      recipientPrivkey: recipient.privkey,
      recipientAddress: recipientP2wpkh.address!,
      network: "testnet",
    })

    const decoded = decodeCSVTimelockScript(result.newTimelockScript)
    expect(decoded.ttlBlocks).toBe(288)

    globalThis.fetch = originalFetch
  })
})
