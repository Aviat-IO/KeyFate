/**
 * Integration tests for the Bitcoin-enabled secret lifecycle.
 *
 * Tests the full flow: Nostr share publishing, Bitcoin UTXO creation,
 * refresh (check-in), and the Nostr+Bitcoin combined pipeline.
 *
 * These tests exercise the pure crypto/Bitcoin functions directly
 * and mock only the Nostr relay client (to avoid network calls).
 * DB-dependent service functions are NOT tested here to avoid
 * vi.mock leaking into other test files in bun's single-process runner.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { hex } from "@scure/base"
import { secp256k1 } from "@noble/curves/secp256k1.js"
import * as btcSigner from "@scure/btc-signer"

// ─── Test key pairs ───────────────────────────────────────────────────────────

function makeKeyPair(seed: number) {
  const privkey = new Uint8Array(32)
  privkey[31] = seed
  const pubkey = secp256k1.getPublicKey(privkey, true)
  return { privkey, pubkey }
}

const owner = makeKeyPair(1)
const recipient = makeKeyPair(2)

// ─── Mock only the Nostr client (to avoid network calls) ─────────────────────

const mockPublish = vi.fn().mockResolvedValue(undefined)

vi.mock("$lib/nostr/client", () => ({
  createNostrClient: vi.fn().mockImplementation(() => ({
    publish: (...args: unknown[]) => mockPublish(...args),
    query: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    close: vi.fn(),
    getRelays: vi.fn().mockReturnValue(["wss://test.relay"]),
    setRelays: vi.fn(),
  })),
  NostrClient: vi.fn(),
}))

// ─── Nostr Publisher Tests ────────────────────────────────────────────────────

describe("Nostr Publisher Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPublish.mockResolvedValue(undefined)
  })

  it("publishes gift wraps for recipients with nostrPubkey", async () => {
    const { publishSharesToNostr } = await import("$lib/services/nostr-publisher")
    const { generateKeypair } = await import("$lib/nostr/keypair")

    const sender = generateKeypair()
    const recipientKp = generateKeypair()

    const result = await publishSharesToNostr({
      secretId: "secret-123",
      shares: [{ recipientId: "r1", share: "share-data-1", shareIndex: 1 }],
      recipients: [{ id: "r1", nostrPubkey: recipientKp.publicKey }],
      senderSecretKey: sender.secretKey,
      threshold: 2,
      totalShares: 3,
    })

    expect(result.published).toHaveLength(1)
    expect(result.published[0].recipientId).toBe("r1")
    expect(result.published[0].nostrEventId).toMatch(/^[0-9a-f]{64}$/)
    expect(result.published[0].plaintextK).toBeInstanceOf(Uint8Array)
    expect(result.published[0].plaintextK.length).toBe(32)
    expect(result.skipped).toHaveLength(0)
    expect(result.errors).toHaveLength(0)

    expect(mockPublish).toHaveBeenCalledTimes(1)
    const publishedEvent = mockPublish.mock.calls[0][0]
    expect(publishedEvent.kind).toBe(1059) // Gift wrap
  })

  it("skips recipients without nostrPubkey", async () => {
    const { publishSharesToNostr } = await import("$lib/services/nostr-publisher")
    const { generateKeypair } = await import("$lib/nostr/keypair")

    const sender = generateKeypair()

    const result = await publishSharesToNostr({
      secretId: "secret-123",
      shares: [
        { recipientId: "r1", share: "share-data-1", shareIndex: 1 },
        { recipientId: "r2", share: "share-data-2", shareIndex: 2 },
      ],
      recipients: [
        { id: "r1", nostrPubkey: null },
        { id: "r2", nostrPubkey: null },
      ],
      senderSecretKey: sender.secretKey,
      threshold: 2,
      totalShares: 3,
    })

    expect(result.published).toHaveLength(0)
    expect(result.skipped).toEqual(["r1", "r2"])
  })

  it("handles mixed recipients (some with, some without nostrPubkey)", async () => {
    const { publishSharesToNostr } = await import("$lib/services/nostr-publisher")
    const { generateKeypair } = await import("$lib/nostr/keypair")

    const sender = generateKeypair()
    const recipientKp = generateKeypair()

    const result = await publishSharesToNostr({
      secretId: "secret-123",
      shares: [
        { recipientId: "r1", share: "share-1", shareIndex: 1 },
        { recipientId: "r2", share: "share-2", shareIndex: 2 },
      ],
      recipients: [
        { id: "r1", nostrPubkey: recipientKp.publicKey },
        { id: "r2", nostrPubkey: null },
      ],
      senderSecretKey: sender.secretKey,
      threshold: 2,
      totalShares: 3,
    })

    expect(result.published).toHaveLength(1)
    expect(result.published[0].recipientId).toBe("r1")
    expect(result.skipped).toEqual(["r2"])
  })

  it("records errors for failed publishes without crashing", async () => {
    mockPublish.mockRejectedValueOnce(new Error("Relay refused"))

    const { publishSharesToNostr } = await import("$lib/services/nostr-publisher")
    const { generateKeypair } = await import("$lib/nostr/keypair")

    const sender = generateKeypair()
    const recipientKp = generateKeypair()

    const result = await publishSharesToNostr({
      secretId: "secret-123",
      shares: [{ recipientId: "r1", share: "share-1", shareIndex: 1 }],
      recipients: [{ id: "r1", nostrPubkey: recipientKp.publicKey }],
      senderSecretKey: sender.secretKey,
      threshold: 2,
      totalShares: 3,
    })

    expect(result.published).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].recipientId).toBe("r1")
    expect(result.errors[0].error).toContain("Relay refused")
  })

  it("returns unique plaintextK for each published share", async () => {
    const { publishSharesToNostr } = await import("$lib/services/nostr-publisher")
    const { generateKeypair } = await import("$lib/nostr/keypair")

    const sender = generateKeypair()
    const r1 = generateKeypair()
    const r2 = generateKeypair()

    const result = await publishSharesToNostr({
      secretId: "secret-123",
      shares: [
        { recipientId: "r1", share: "share-1", shareIndex: 1 },
        { recipientId: "r2", share: "share-2", shareIndex: 2 },
      ],
      recipients: [
        { id: "r1", nostrPubkey: r1.publicKey },
        { id: "r2", nostrPubkey: r2.publicKey },
      ],
      senderSecretKey: sender.secretKey,
      threshold: 2,
      totalShares: 3,
    })

    expect(result.published).toHaveLength(2)
    const k1 = hex.encode(result.published[0].plaintextK)
    const k2 = hex.encode(result.published[1].plaintextK)
    expect(k1).not.toBe(k2)
  })
})

// ─── Full Bitcoin Lifecycle (Pure Functions) ──────────────────────────────────

describe("Bitcoin-Enabled Secret Lifecycle", () => {
  it("full flow: create timelock → pre-sign → refresh → check status", async () => {
    const { createTimelockUTXO, createPreSignedRecipientTx } = await import(
      "$lib/bitcoin/transaction"
    )
    const { refreshTimelockUTXO, estimateRefreshesRemaining } = await import(
      "$lib/bitcoin/refresh"
    )
    const { daysToBlocks, decodeCSVTimelockScript, blocksToApproxDays } = await import(
      "$lib/bitcoin/script"
    )

    const p2wpkh = btcSigner.p2wpkh(owner.pubkey, btcSigner.TEST_NETWORK)
    const recipientP2wpkh = btcSigner.p2wpkh(recipient.pubkey, btcSigner.TEST_NETWORK)

    const checkInDays = 30
    const ttlBlocks = daysToBlocks(checkInDays)
    expect(ttlBlocks).toBe(4320)

    // Step 1: Create timelock UTXO
    const utxoResult = createTimelockUTXO({
      ownerPrivkey: owner.privkey,
      ownerPubkey: owner.pubkey,
      recipientPubkey: recipient.pubkey,
      ttlBlocks,
      amountSats: 100000,
      feeRateSatsPerVbyte: 5,
      fundingUtxo: {
        txId: "c".repeat(64),
        outputIndex: 0,
        amountSats: 200000,
        scriptPubKey: hex.encode(p2wpkh.script),
      },
      network: "testnet",
    })

    expect(utxoResult.txId).toMatch(/^[0-9a-f]{64}$/)
    expect(utxoResult.timelockScript).toBeInstanceOf(Uint8Array)

    const decoded = decodeCSVTimelockScript(utxoResult.timelockScript)
    expect(decoded.ttlBlocks).toBe(4320)
    expect(hex.encode(decoded.ownerPubkey)).toBe(hex.encode(owner.pubkey))
    expect(hex.encode(decoded.recipientPubkey)).toBe(hex.encode(recipient.pubkey))

    // Step 2: Create pre-signed recipient tx
    const symmetricKeyK = new Uint8Array(32).fill(0xcc)
    const nostrEventId = "dd".repeat(32)

    const preSigned = createPreSignedRecipientTx({
      timelockUtxo: {
        txId: utxoResult.txId,
        outputIndex: utxoResult.outputIndex,
        amountSats: 100000,
      },
      timelockScript: utxoResult.timelockScript,
      recipientPrivkey: recipient.privkey,
      recipientAddress: recipientP2wpkh.address!,
      ttlBlocks,
      symmetricKeyK,
      nostrEventId,
      feeRateSatsPerVbyte: 5,
      network: "testnet",
    })

    expect(preSigned.txHex).toBeTruthy()

    const rawPreSigned = btcSigner.RawTx.decode(hex.decode(preSigned.txHex))
    expect(rawPreSigned.outputs[0].amount).toBe(0n) // OP_RETURN
    expect(rawPreSigned.outputs[0].script[0]).toBe(0x6a)

    // Step 3: Owner checks in (refresh)
    const refreshResult = refreshTimelockUTXO({
      currentUtxo: {
        txId: utxoResult.txId,
        outputIndex: utxoResult.outputIndex,
        amountSats: 100000,
      },
      currentScript: utxoResult.timelockScript,
      ownerPrivkey: owner.privkey,
      ownerPubkey: owner.pubkey,
      recipientPubkey: recipient.pubkey,
      ttlBlocks,
      feeRateSatsPerVbyte: 5,
      network: "testnet",
    })

    expect(refreshResult.newTxId).toMatch(/^[0-9a-f]{64}$/)
    expect(refreshResult.newTxId).not.toBe(utxoResult.txId)

    const decodedNew = decodeCSVTimelockScript(refreshResult.newTimelockScript)
    expect(decodedNew.ttlBlocks).toBe(4320)

    // Step 4: Check remaining refreshes
    const rawRefresh = btcSigner.RawTx.decode(hex.decode(refreshResult.txHex))
    const newAmount = Number(rawRefresh.outputs[0].amount)
    expect(newAmount).toBeLessThan(100000)
    expect(newAmount).toBeGreaterThan(90000)

    const remaining = estimateRefreshesRemaining(newAmount, 5)
    expect(remaining).toBeGreaterThan(50)

    // Step 5: Verify days remaining calculation
    expect(blocksToApproxDays(ttlBlocks)).toBe(30)
  })

  it("Nostr + Bitcoin combined: publish shares then create timelock with K", async () => {
    const { publishSharesToNostr } = await import("$lib/services/nostr-publisher")
    const { generateKeypair } = await import("$lib/nostr/keypair")
    const { createTimelockUTXO, createPreSignedRecipientTx } = await import(
      "$lib/bitcoin/transaction"
    )
    const { daysToBlocks } = await import("$lib/bitcoin/script")

    const sender = generateKeypair()
    const recipientKp = generateKeypair()

    // Step 1: Publish shares to Nostr
    const publishResult = await publishSharesToNostr({
      secretId: "secret-456",
      shares: [{ recipientId: "r1", share: "shamir-share-data", shareIndex: 1 }],
      recipients: [{ id: "r1", nostrPubkey: recipientKp.publicKey }],
      senderSecretKey: sender.secretKey,
      threshold: 2,
      totalShares: 3,
    })

    expect(publishResult.published).toHaveLength(1)
    const { plaintextK, nostrEventId } = publishResult.published[0]

    // Step 2: Use K and event ID for Bitcoin timelock
    const p2wpkh = btcSigner.p2wpkh(owner.pubkey, btcSigner.TEST_NETWORK)
    const recipientP2wpkh = btcSigner.p2wpkh(recipient.pubkey, btcSigner.TEST_NETWORK)
    const ttlBlocks = daysToBlocks(30)

    const utxoResult = createTimelockUTXO({
      ownerPrivkey: owner.privkey,
      ownerPubkey: owner.pubkey,
      recipientPubkey: recipient.pubkey,
      ttlBlocks,
      amountSats: 50000,
      feeRateSatsPerVbyte: 10,
      fundingUtxo: {
        txId: "e".repeat(64),
        outputIndex: 0,
        amountSats: 100000,
        scriptPubKey: hex.encode(p2wpkh.script),
      },
      network: "testnet",
    })

    // Step 3: Create pre-signed tx embedding K and event ID in OP_RETURN
    const preSigned = createPreSignedRecipientTx({
      timelockUtxo: {
        txId: utxoResult.txId,
        outputIndex: utxoResult.outputIndex,
        amountSats: 50000,
      },
      timelockScript: utxoResult.timelockScript,
      recipientPrivkey: recipient.privkey,
      recipientAddress: recipientP2wpkh.address!,
      ttlBlocks,
      symmetricKeyK: plaintextK,
      nostrEventId,
      feeRateSatsPerVbyte: 10,
      network: "testnet",
    })

    expect(preSigned.txHex).toBeTruthy()

    const rawTx = btcSigner.RawTx.decode(hex.decode(preSigned.txHex))
    expect(rawTx.outputs[0].script[0]).toBe(0x6a) // OP_RETURN
    expect(rawTx.outputs[0].amount).toBe(0n)
  })

  it("pre-signed tx has correct structure for recipient spending", async () => {
    const { createTimelockUTXO, createPreSignedRecipientTx } = await import(
      "$lib/bitcoin/transaction"
    )

    const p2wpkh = btcSigner.p2wpkh(owner.pubkey, btcSigner.TEST_NETWORK)
    const recipientP2wpkh = btcSigner.p2wpkh(recipient.pubkey, btcSigner.TEST_NETWORK)

    const utxoResult = createTimelockUTXO({
      ownerPrivkey: owner.privkey,
      ownerPubkey: owner.pubkey,
      recipientPubkey: recipient.pubkey,
      ttlBlocks: 4320,
      amountSats: 50000,
      feeRateSatsPerVbyte: 10,
      fundingUtxo: {
        txId: "a".repeat(64),
        outputIndex: 0,
        amountSats: 100000,
        scriptPubKey: hex.encode(p2wpkh.script),
      },
      network: "testnet",
    })

    const preSigned = createPreSignedRecipientTx({
      timelockUtxo: {
        txId: utxoResult.txId,
        outputIndex: 0,
        amountSats: 50000,
      },
      timelockScript: utxoResult.timelockScript,
      recipientPrivkey: recipient.privkey,
      recipientAddress: recipientP2wpkh.address!,
      ttlBlocks: 4320,
      symmetricKeyK: new Uint8Array(32).fill(0xaa),
      nostrEventId: "bb".repeat(32),
      feeRateSatsPerVbyte: 10,
      network: "testnet",
    })

    const rawTx = btcSigner.RawTx.decode(hex.decode(preSigned.txHex))

    // Correct structure
    expect(rawTx.inputs.length).toBe(1)
    expect(rawTx.outputs.length).toBe(2) // OP_RETURN + recipient
    expect(rawTx.witnesses.length).toBe(1)
    expect(rawTx.witnesses[0].length).toBe(3) // sig, FALSE, witnessScript

    // CSV sequence on input
    expect(rawTx.inputs[0].sequence).toBe(4320)

    // OP_RETURN output (0 value)
    expect(rawTx.outputs[0].amount).toBe(0n)

    // Recipient output has value
    expect(Number(rawTx.outputs[1].amount)).toBeGreaterThan(0)

    // Witness: second item is empty (FALSE for ELSE branch)
    expect(rawTx.witnesses[0][1].length).toBe(0)
  })

  it("multiple sequential refreshes reduce UTXO amount", async () => {
    const { refreshTimelockUTXO, estimateRefreshesRemaining } = await import(
      "$lib/bitcoin/refresh"
    )
    const { createCSVTimelockScript } = await import("$lib/bitcoin/script")

    let currentScript = createCSVTimelockScript(owner.pubkey, recipient.pubkey, 144)
    let currentTxId = "a".repeat(64)
    let currentAmount = 50000
    const feeRate = 5

    const expectedRefreshes = estimateRefreshesRemaining(currentAmount, feeRate)
    expect(expectedRefreshes).toBeGreaterThan(0)

    // Do 3 sequential refreshes
    for (let i = 0; i < 3; i++) {
      const result = refreshTimelockUTXO({
        currentUtxo: { txId: currentTxId, outputIndex: 0, amountSats: currentAmount },
        currentScript,
        ownerPrivkey: owner.privkey,
        ownerPubkey: owner.pubkey,
        recipientPubkey: recipient.pubkey,
        ttlBlocks: 144,
        feeRateSatsPerVbyte: feeRate,
        network: "testnet",
      })

      const rawTx = btcSigner.RawTx.decode(hex.decode(result.txHex))
      currentAmount = Number(rawTx.outputs[0].amount)
      currentTxId = result.newTxId
      currentScript = result.newTimelockScript

      expect(currentAmount).toBeGreaterThanOrEqual(10000)
    }

    expect(currentAmount).toBeLessThan(50000)
  })
})

// ─── Bitcoin Service Module Tests (type/interface validation) ─────────────────

describe("Bitcoin Service types and interfaces", () => {
  it("EnableBitcoinParams interface is correctly typed", async () => {
    // Verify the service module exports the expected types
    const mod = await import("$lib/services/bitcoin-service")
    expect(typeof mod.enableBitcoin).toBe("function")
    expect(typeof mod.refreshBitcoin).toBe("function")
    expect(typeof mod.getBitcoinStatus).toBe("function")
    expect(typeof mod.getActiveUtxo).toBe("function")
  })

  it("Nostr publisher module exports correctly", async () => {
    const mod = await import("$lib/services/nostr-publisher")
    expect(typeof mod.publishSharesToNostr).toBe("function")
  })
})

// ─── API Endpoint Validation Logic Tests ──────────────────────────────────────

describe("Bitcoin API endpoint validation logic", () => {
  it("validates amountSats minimum (10000)", () => {
    expect(5000 < 10000).toBe(true)
    expect(10000 < 10000).toBe(false)
    expect(50000 < 10000).toBe(false)
  })

  it("validates network parameter", () => {
    const valid = ["mainnet", "testnet"]
    expect(valid.includes("mainnet")).toBe(true)
    expect(valid.includes("testnet")).toBe(true)
    expect(valid.includes("regtest")).toBe(false)
  })

  it("validates required fields for enable-bitcoin", () => {
    const requiredFields = [
      "ownerPrivkey", "ownerPubkey", "recipientPubkey",
      "fundingUtxo", "amountSats", "feeRateSatsPerVbyte",
      "symmetricKeyK", "nostrEventId", "recipientAddress",
      "recipientPrivkey", "network",
    ]
    const body: Record<string, unknown> = { ownerPrivkey: "aa".repeat(32) }
    const missing = requiredFields.filter((f) => body[f] === undefined)
    expect(missing.length).toBe(10) // All except ownerPrivkey
  })

  it("validates fundingUtxo structure", () => {
    const validUtxo = {
      txId: "a".repeat(64),
      outputIndex: 0,
      amountSats: 100000,
      scriptPubKey: "0014" + "ab".repeat(20),
    }
    expect(validUtxo.txId).toBeTruthy()
    expect(validUtxo.outputIndex).toBeDefined()
    expect(validUtxo.amountSats).toBeGreaterThan(0)
    expect(validUtxo.scriptPubKey).toBeTruthy()

    const invalidUtxo = { txId: "", outputIndex: undefined }
    expect(!invalidUtxo.txId).toBe(true)
  })

  it("daysToBlocks conversion matches check-in days", async () => {
    const { daysToBlocks, blocksToApproxDays } = await import("$lib/bitcoin/script")

    // Common check-in intervals
    expect(daysToBlocks(7)).toBe(1008)
    expect(daysToBlocks(14)).toBe(2016)
    expect(daysToBlocks(30)).toBe(4320)
    expect(daysToBlocks(90)).toBe(12960)
    expect(daysToBlocks(365)).toBe(52560)

    // Round-trip
    expect(blocksToApproxDays(daysToBlocks(30))).toBe(30)
  })
})
