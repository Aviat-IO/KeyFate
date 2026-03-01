/**
 * Tests for Bitcoin CSV timelock module.
 *
 * Tests script construction, address generation, transaction building,
 * refresh logic, broadcast, and fee estimation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as btc from "@scure/btc-signer"
import { hex } from "@scure/base"
import { secp256k1 } from "@noble/curves/secp256k1.js"

// ─── Test key pairs ───────────────────────────────────────────────────────────

function makeKeyPair(seed: number) {
  const privkey = new Uint8Array(32)
  privkey[31] = seed
  const pubkey = secp256k1.getPublicKey(privkey, true)
  return { privkey, pubkey }
}

const owner = makeKeyPair(1)
const recipient = makeKeyPair(2)

// ─── Script tests ─────────────────────────────────────────────────────────────

describe("Bitcoin CSV Timelock - Script", () => {
  describe("daysToBlocks", () => {
    it("converts 1 day to 144 blocks", async () => {
      const { daysToBlocks } = await import("$lib/bitcoin/script")
      expect(daysToBlocks(1)).toBe(144)
    })

    it("converts 30 days to 4320 blocks", async () => {
      const { daysToBlocks } = await import("$lib/bitcoin/script")
      expect(daysToBlocks(30)).toBe(4320)
    })

    it("converts 365 days to 52560 blocks", async () => {
      const { daysToBlocks } = await import("$lib/bitcoin/script")
      expect(daysToBlocks(365)).toBe(52560)
    })

    it("throws for 0 days", async () => {
      const { daysToBlocks } = await import("$lib/bitcoin/script")
      expect(() => daysToBlocks(0)).toThrow("Days must be positive")
    })

    it("throws for negative days", async () => {
      const { daysToBlocks } = await import("$lib/bitcoin/script")
      expect(() => daysToBlocks(-1)).toThrow("Days must be positive")
    })

    it("throws when exceeding MAX_CSV_BLOCKS", async () => {
      const { daysToBlocks } = await import("$lib/bitcoin/script")
      expect(() => daysToBlocks(500)).toThrow("exceeds max CSV value")
    })
  })

  describe("blocksToApproxDays", () => {
    it("converts 144 blocks to 1 day", async () => {
      const { blocksToApproxDays } = await import("$lib/bitcoin/script")
      expect(blocksToApproxDays(144)).toBe(1)
    })

    it("converts 4320 blocks to 30 days", async () => {
      const { blocksToApproxDays } = await import("$lib/bitcoin/script")
      expect(blocksToApproxDays(4320)).toBe(30)
    })

    it("throws for 0 blocks", async () => {
      const { blocksToApproxDays } = await import("$lib/bitcoin/script")
      expect(() => blocksToApproxDays(0)).toThrow("Blocks must be positive")
    })
  })

  describe("createCSVTimelockScript", () => {
    it("creates a valid script with correct structure", async () => {
      const { createCSVTimelockScript, decodeCSVTimelockScript } = await import(
        "$lib/bitcoin/script"
      )
      const script = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        144,
      )

      expect(script).toBeInstanceOf(Uint8Array)
      expect(script.length).toBeGreaterThan(0)

      // Verify round-trip decode
      const decoded = decodeCSVTimelockScript(script)
      expect(hex.encode(decoded.ownerPubkey)).toBe(hex.encode(owner.pubkey))
      expect(hex.encode(decoded.recipientPubkey)).toBe(
        hex.encode(recipient.pubkey),
      )
      expect(decoded.ttlBlocks).toBe(144)
    })

    it("encodes the correct opcodes", async () => {
      const { createCSVTimelockScript } = await import("$lib/bitcoin/script")
      const script = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        144,
      )

      // Decode and verify structure
      const decoded = btc.Script.decode(script)
      expect(decoded[0]).toBe("IF")
      expect(decoded[2]).toBe("CHECKSIG")
      expect(decoded[3]).toBe("ELSE")
      expect(decoded[5]).toBe("CHECKSEQUENCEVERIFY")
      expect(decoded[6]).toBe("DROP")
      expect(decoded[8]).toBe("CHECKSIG")
      expect(decoded[9]).toBe("ENDIF")
    })

    it("handles maximum CSV value (65535 blocks)", async () => {
      const { createCSVTimelockScript, decodeCSVTimelockScript } = await import(
        "$lib/bitcoin/script"
      )
      const script = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        65535,
      )
      const decoded = decodeCSVTimelockScript(script)
      expect(decoded.ttlBlocks).toBe(65535)
    })

    it("handles minimum CSV value (1 block)", async () => {
      const { createCSVTimelockScript, decodeCSVTimelockScript } = await import(
        "$lib/bitcoin/script"
      )
      const script = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        1,
      )
      const decoded = decodeCSVTimelockScript(script)
      expect(decoded.ttlBlocks).toBe(1)
    })

    it("throws for invalid owner pubkey length", async () => {
      const { createCSVTimelockScript } = await import("$lib/bitcoin/script")
      expect(() =>
        createCSVTimelockScript(
          new Uint8Array(32),
          recipient.pubkey,
          144,
        ),
      ).toThrow("Owner pubkey must be 33 bytes")
    })

    it("throws for invalid recipient pubkey length", async () => {
      const { createCSVTimelockScript } = await import("$lib/bitcoin/script")
      expect(() =>
        createCSVTimelockScript(
          owner.pubkey,
          new Uint8Array(65),
          144,
        ),
      ).toThrow("Recipient pubkey must be 33 bytes")
    })

    it("throws for ttlBlocks = 0", async () => {
      const { createCSVTimelockScript } = await import("$lib/bitcoin/script")
      expect(() =>
        createCSVTimelockScript(owner.pubkey, recipient.pubkey, 0),
      ).toThrow("ttlBlocks must be between 1 and 65535")
    })

    it("throws for ttlBlocks > MAX_CSV_BLOCKS", async () => {
      const { createCSVTimelockScript } = await import("$lib/bitcoin/script")
      expect(() =>
        createCSVTimelockScript(owner.pubkey, recipient.pubkey, 65536),
      ).toThrow("ttlBlocks must be between 1 and 65535")
    })

    it("throws for non-integer ttlBlocks", async () => {
      const { createCSVTimelockScript } = await import("$lib/bitcoin/script")
      expect(() =>
        createCSVTimelockScript(owner.pubkey, recipient.pubkey, 144.5),
      ).toThrow("ttlBlocks must be an integer")
    })

    it("produces deterministic output for same inputs", async () => {
      const { createCSVTimelockScript } = await import("$lib/bitcoin/script")
      const script1 = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        144,
      )
      const script2 = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        144,
      )
      expect(hex.encode(script1)).toBe(hex.encode(script2))
    })

    it("produces different output for different TTLs", async () => {
      const { createCSVTimelockScript } = await import("$lib/bitcoin/script")
      const script1 = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        144,
      )
      const script2 = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        288,
      )
      expect(hex.encode(script1)).not.toBe(hex.encode(script2))
    })
  })

  describe("createP2WSHAddress", () => {
    it("generates a valid mainnet bech32 address", async () => {
      const { createCSVTimelockScript, createP2WSHAddress } = await import(
        "$lib/bitcoin/script"
      )
      const script = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        144,
      )
      const address = createP2WSHAddress(script, "mainnet")
      expect(address).toMatch(/^bc1q[a-z0-9]+$/)
    })

    it("generates a valid testnet bech32 address", async () => {
      const { createCSVTimelockScript, createP2WSHAddress } = await import(
        "$lib/bitcoin/script"
      )
      const script = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        144,
      )
      const address = createP2WSHAddress(script, "testnet")
      expect(address).toMatch(/^tb1q[a-z0-9]+$/)
    })

    it("produces different addresses for mainnet and testnet", async () => {
      const { createCSVTimelockScript, createP2WSHAddress } = await import(
        "$lib/bitcoin/script"
      )
      const script = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        144,
      )
      const mainnet = createP2WSHAddress(script, "mainnet")
      const testnet = createP2WSHAddress(script, "testnet")
      expect(mainnet).not.toBe(testnet)
    })

    it("produces deterministic addresses", async () => {
      const { createCSVTimelockScript, createP2WSHAddress } = await import(
        "$lib/bitcoin/script"
      )
      const script = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        144,
      )
      const addr1 = createP2WSHAddress(script, "mainnet")
      const addr2 = createP2WSHAddress(script, "mainnet")
      expect(addr1).toBe(addr2)
    })
  })

  describe("decodeCSVTimelockScript", () => {
    it("round-trips with createCSVTimelockScript", async () => {
      const { createCSVTimelockScript, decodeCSVTimelockScript } = await import(
        "$lib/bitcoin/script"
      )
      const ttlBlocks = 4320 // 30 days
      const script = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        ttlBlocks,
      )
      const decoded = decodeCSVTimelockScript(script)

      expect(hex.encode(decoded.ownerPubkey)).toBe(hex.encode(owner.pubkey))
      expect(hex.encode(decoded.recipientPubkey)).toBe(
        hex.encode(recipient.pubkey),
      )
      expect(decoded.ttlBlocks).toBe(ttlBlocks)
    })

    it("throws for invalid script", async () => {
      const { decodeCSVTimelockScript } = await import("$lib/bitcoin/script")
      const badScript = btc.Script.encode(["IF", "ENDIF"])
      expect(() => decodeCSVTimelockScript(badScript)).toThrow(
        "Invalid CSV timelock script",
      )
    })
  })

  describe("createOpReturnPayload", () => {
    it("creates a 64-byte payload", async () => {
      const { createOpReturnPayload } = await import("$lib/bitcoin/script")
      const key = new Uint8Array(32).fill(0xaa)
      const eventId = "ab".repeat(32)
      const payload = createOpReturnPayload(key, eventId)

      expect(payload.length).toBe(64)
      // First 32 bytes = key
      expect(hex.encode(payload.slice(0, 32))).toBe("aa".repeat(32))
      // Last 32 bytes = event ID
      expect(hex.encode(payload.slice(32))).toBe("ab".repeat(32))
    })

    it("throws for wrong key length", async () => {
      const { createOpReturnPayload } = await import("$lib/bitcoin/script")
      expect(() =>
        createOpReturnPayload(new Uint8Array(16), "ab".repeat(32)),
      ).toThrow("Symmetric key must be 32 bytes")
    })

    it("throws for wrong event ID length", async () => {
      const { createOpReturnPayload } = await import("$lib/bitcoin/script")
      expect(() =>
        createOpReturnPayload(new Uint8Array(32), "ab".repeat(16)),
      ).toThrow("Nostr event ID must be 64 hex chars")
    })
  })

  describe("createOpReturnScript", () => {
    it("creates a valid OP_RETURN script", async () => {
      const { createOpReturnScript } = await import("$lib/bitcoin/script")
      const data = new Uint8Array(64).fill(0xab)
      const script = createOpReturnScript(data)

      // Should start with OP_RETURN (0x6a)
      expect(script[0]).toBe(0x6a)
      expect(script.length).toBeGreaterThan(64)
    })

    it("throws for data > 80 bytes", async () => {
      const { createOpReturnScript } = await import("$lib/bitcoin/script")
      expect(() => createOpReturnScript(new Uint8Array(81))).toThrow(
        "OP_RETURN data too large",
      )
    })

    it("accepts exactly 80 bytes", async () => {
      const { createOpReturnScript } = await import("$lib/bitcoin/script")
      const script = createOpReturnScript(new Uint8Array(80))
      expect(script[0]).toBe(0x6a)
    })
  })
})

// ─── Transaction tests ────────────────────────────────────────────────────────

describe("Bitcoin CSV Timelock - Transaction", () => {
  describe("createTimelockUTXO", () => {
    it("creates a valid timelock UTXO transaction", async () => {
      const { createTimelockUTXO } = await import("$lib/bitcoin/transaction")
      const { decodeCSVTimelockScript } = await import("$lib/bitcoin/script")

      // Create a P2WPKH address for the owner to use as funding
      const p2wpkh = btc.p2wpkh(owner.pubkey)

      const result = createTimelockUTXO({
        ownerPrivkey: owner.privkey,
        ownerPubkey: owner.pubkey,
        recipientPubkey: recipient.pubkey,
        ttlBlocks: 144,
        amountSats: 50000,
        feeRateSatsPerVbyte: 10,
        fundingUtxo: {
          txId: "a".repeat(64),
          outputIndex: 0,
          amountSats: 100000,
          scriptPubKey: hex.encode(p2wpkh.script),
        },
        network: "mainnet",
      })

      expect(result.txHex).toBeTruthy()
      expect(result.txId).toMatch(/^[0-9a-f]{64}$/)
      expect(result.outputIndex).toBe(0)
      expect(result.timelockScript).toBeInstanceOf(Uint8Array)

      // Verify the timelock script is valid
      const decoded = decodeCSVTimelockScript(result.timelockScript)
      expect(decoded.ttlBlocks).toBe(144)
    })

    it("throws for amount below minimum", async () => {
      const { createTimelockUTXO } = await import("$lib/bitcoin/transaction")
      const p2wpkh = btc.p2wpkh(owner.pubkey)

      expect(() =>
        createTimelockUTXO({
          ownerPrivkey: owner.privkey,
          ownerPubkey: owner.pubkey,
          recipientPubkey: recipient.pubkey,
          ttlBlocks: 144,
          amountSats: 100, // Below MIN_UTXO_SATS
          feeRateSatsPerVbyte: 10,
          fundingUtxo: {
            txId: "a".repeat(64),
            outputIndex: 0,
            amountSats: 100000,
            scriptPubKey: hex.encode(p2wpkh.script),
          },
          network: "mainnet",
        }),
      ).toThrow("below minimum")
    })

    it("throws for insufficient funds", async () => {
      const { createTimelockUTXO } = await import("$lib/bitcoin/transaction")
      const p2wpkh = btc.p2wpkh(owner.pubkey)

      expect(() =>
        createTimelockUTXO({
          ownerPrivkey: owner.privkey,
          ownerPubkey: owner.pubkey,
          recipientPubkey: recipient.pubkey,
          ttlBlocks: 144,
          amountSats: 50000,
          feeRateSatsPerVbyte: 10,
          fundingUtxo: {
            txId: "a".repeat(64),
            outputIndex: 0,
            amountSats: 50000, // Not enough for amount + fee
            scriptPubKey: hex.encode(p2wpkh.script),
          },
          network: "mainnet",
        }),
      ).toThrow("Insufficient funds")
    })

    it("includes change output when change > dust", async () => {
      const { createTimelockUTXO } = await import("$lib/bitcoin/transaction")
      const p2wpkh = btc.p2wpkh(owner.pubkey)

      const result = createTimelockUTXO({
        ownerPrivkey: owner.privkey,
        ownerPubkey: owner.pubkey,
        recipientPubkey: recipient.pubkey,
        ttlBlocks: 144,
        amountSats: 50000,
        feeRateSatsPerVbyte: 10,
        fundingUtxo: {
          txId: "a".repeat(64),
          outputIndex: 0,
          amountSats: 100000,
          scriptPubKey: hex.encode(p2wpkh.script),
        },
        network: "mainnet",
      })

      // Decode the transaction to verify outputs
      const rawTx = btc.RawTx.decode(hex.decode(result.txHex))
      // Should have 2 outputs: timelock + change
      expect(rawTx.outputs.length).toBe(2)
    })

    it("works with testnet", async () => {
      const { createTimelockUTXO } = await import("$lib/bitcoin/transaction")
      const p2wpkh = btc.p2wpkh(owner.pubkey, btc.TEST_NETWORK)

      const result = createTimelockUTXO({
        ownerPrivkey: owner.privkey,
        ownerPubkey: owner.pubkey,
        recipientPubkey: recipient.pubkey,
        ttlBlocks: 144,
        amountSats: 50000,
        feeRateSatsPerVbyte: 10,
        fundingUtxo: {
          txId: "b".repeat(64),
          outputIndex: 0,
          amountSats: 100000,
          scriptPubKey: hex.encode(p2wpkh.script),
        },
        network: "testnet",
      })

      expect(result.txHex).toBeTruthy()
      expect(result.txId).toMatch(/^[0-9a-f]{64}$/)
    })
  })

  describe("createPreSignedRecipientTx", () => {
    it("creates a valid pre-signed recipient transaction", async () => {
      const { createTimelockUTXO, createPreSignedRecipientTx } = await import(
        "$lib/bitcoin/transaction"
      )
      const p2wpkh = btc.p2wpkh(owner.pubkey)

      // First create the timelock UTXO
      const utxoResult = createTimelockUTXO({
        ownerPrivkey: owner.privkey,
        ownerPubkey: owner.pubkey,
        recipientPubkey: recipient.pubkey,
        ttlBlocks: 144,
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

      // Create the pre-signed recipient tx
      const recipientP2wpkh = btc.p2wpkh(recipient.pubkey, btc.TEST_NETWORK)
      const result = createPreSignedRecipientTx({
        timelockUtxo: {
          txId: utxoResult.txId,
          outputIndex: utxoResult.outputIndex,
          amountSats: 50000,
        },
        timelockScript: utxoResult.timelockScript,
        recipientPrivkey: recipient.privkey,
        recipientAddress: recipientP2wpkh.address!,
        ttlBlocks: 144,
        symmetricKeyK: new Uint8Array(32).fill(0xaa),
        nostrEventId: "bb".repeat(32),
        feeRateSatsPerVbyte: 10,
        network: "testnet",
      })

      expect(result.txHex).toBeTruthy()

      // Decode and verify structure
      const rawTx = btc.RawTx.decode(hex.decode(result.txHex))

      // Should have 2 outputs: OP_RETURN + recipient
      expect(rawTx.outputs.length).toBe(2)

      // First output should be OP_RETURN (amount = 0)
      expect(rawTx.outputs[0].amount).toBe(0n)

      // Verify OP_RETURN contains our data
      const opReturnScript = rawTx.outputs[0].script
      expect(opReturnScript[0]).toBe(0x6a) // OP_RETURN

      // Input should have CSV sequence
      expect(rawTx.inputs[0].sequence).toBe(144)

      // Should have witness data (3 items: sig, FALSE, witnessScript)
      expect(rawTx.witnesses[0].length).toBe(3)
      // Second witness item should be empty (FALSE for ELSE branch)
      expect(rawTx.witnesses[0][1].length).toBe(0)
    })

    it("throws when UTXO too small for fees", async () => {
      const { createPreSignedRecipientTx } = await import(
        "$lib/bitcoin/transaction"
      )
      const { createCSVTimelockScript } = await import("$lib/bitcoin/script")

      const script = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        144,
      )
      const recipientP2wpkh = btc.p2wpkh(recipient.pubkey, btc.TEST_NETWORK)

      expect(() =>
        createPreSignedRecipientTx({
          timelockUtxo: {
            txId: "a".repeat(64),
            outputIndex: 0,
            amountSats: 1000, // Too small
          },
          timelockScript: script,
          recipientPrivkey: recipient.privkey,
          recipientAddress: recipientP2wpkh.address!,
          ttlBlocks: 144,
          symmetricKeyK: new Uint8Array(32).fill(0xaa),
          nostrEventId: "bb".repeat(32),
          feeRateSatsPerVbyte: 10,
          network: "testnet",
        }),
      ).toThrow("too small to cover fee")
    })
  })

  describe("estimateTimelockCreationVbytes", () => {
    it("returns a reasonable estimate", async () => {
      const { estimateTimelockCreationVbytes } = await import(
        "$lib/bitcoin/transaction"
      )
      const vbytes = estimateTimelockCreationVbytes()
      expect(vbytes).toBeGreaterThan(100)
      expect(vbytes).toBeLessThan(300)
    })
  })

  describe("estimateRecipientSpendVbytes", () => {
    it("returns a reasonable estimate", async () => {
      const { estimateRecipientSpendVbytes } = await import(
        "$lib/bitcoin/transaction"
      )
      const vbytes = estimateRecipientSpendVbytes()
      expect(vbytes).toBeGreaterThan(200)
      expect(vbytes).toBeLessThan(400)
    })
  })
})

// ─── Refresh tests ────────────────────────────────────────────────────────────

describe("Bitcoin CSV Timelock - Refresh", () => {
  describe("refreshTimelockUTXO", () => {
    it("creates a valid refresh transaction", async () => {
      const { createTimelockUTXO } = await import("$lib/bitcoin/transaction")
      const { refreshTimelockUTXO } = await import("$lib/bitcoin/refresh")
      const { decodeCSVTimelockScript } = await import("$lib/bitcoin/script")
      const p2wpkh = btc.p2wpkh(owner.pubkey)

      // Create initial timelock UTXO
      const initial = createTimelockUTXO({
        ownerPrivkey: owner.privkey,
        ownerPubkey: owner.pubkey,
        recipientPubkey: recipient.pubkey,
        ttlBlocks: 144,
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

      // Refresh (check-in)
      const result = refreshTimelockUTXO({
        currentUtxo: {
          txId: initial.txId,
          outputIndex: initial.outputIndex,
          amountSats: 50000,
        },
        currentScript: initial.timelockScript,
        ownerPrivkey: owner.privkey,
        ownerPubkey: owner.pubkey,
        recipientPubkey: recipient.pubkey,
        ttlBlocks: 144,
        feeRateSatsPerVbyte: 10,
        network: "testnet",
      })

      expect(result.txHex).toBeTruthy()
      expect(result.newTxId).toMatch(/^[0-9a-f]{64}$/)
      expect(result.newOutputIndex).toBe(0)
      expect(result.newTimelockScript).toBeInstanceOf(Uint8Array)

      // Verify the new script is valid
      const decoded = decodeCSVTimelockScript(result.newTimelockScript)
      expect(decoded.ttlBlocks).toBe(144)

      // Verify the transaction structure
      const rawTx = btc.RawTx.decode(hex.decode(result.txHex))

      // Should have 1 output (new timelock UTXO)
      expect(rawTx.outputs.length).toBe(1)

      // Input should NOT have CSV sequence (owner path)
      expect(rawTx.inputs[0].sequence).toBe(0xfffffffe)

      // Should have witness data (3 items: sig, TRUE, witnessScript)
      expect(rawTx.witnesses[0].length).toBe(3)
      // Second witness item should be 0x01 (TRUE for IF branch)
      expect(rawTx.witnesses[0][1].length).toBe(1)
      expect(rawTx.witnesses[0][1][0]).toBe(0x01)
    })

    it("reduces amount by fee", async () => {
      const { refreshTimelockUTXO } = await import("$lib/bitcoin/refresh")
      const { createCSVTimelockScript } = await import("$lib/bitcoin/script")

      const script = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        144,
      )

      const result = refreshTimelockUTXO({
        currentUtxo: {
          txId: "a".repeat(64),
          outputIndex: 0,
          amountSats: 50000,
        },
        currentScript: script,
        ownerPrivkey: owner.privkey,
        ownerPubkey: owner.pubkey,
        recipientPubkey: recipient.pubkey,
        ttlBlocks: 144,
        feeRateSatsPerVbyte: 10,
        network: "testnet",
      })

      // Decode to check output amount
      const rawTx = btc.RawTx.decode(hex.decode(result.txHex))
      const outputAmount = Number(rawTx.outputs[0].amount)

      // Should be less than input (fee deducted)
      expect(outputAmount).toBeLessThan(50000)
      // But still above minimum
      expect(outputAmount).toBeGreaterThanOrEqual(10000)
    })

    it("throws when remaining amount below minimum", async () => {
      const { refreshTimelockUTXO } = await import("$lib/bitcoin/refresh")
      const { createCSVTimelockScript } = await import("$lib/bitcoin/script")

      const script = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        144,
      )

      expect(() =>
        refreshTimelockUTXO({
          currentUtxo: {
            txId: "a".repeat(64),
            outputIndex: 0,
            amountSats: 11000, // Just barely above minimum, fee will push below
          },
          currentScript: script,
          ownerPrivkey: owner.privkey,
          ownerPubkey: owner.pubkey,
          recipientPubkey: recipient.pubkey,
          ttlBlocks: 144,
          feeRateSatsPerVbyte: 10,
          network: "testnet",
        }),
      ).toThrow("below minimum")
    })

    it("can change TTL on refresh", async () => {
      const { refreshTimelockUTXO } = await import("$lib/bitcoin/refresh")
      const { createCSVTimelockScript, decodeCSVTimelockScript } = await import(
        "$lib/bitcoin/script"
      )

      const script = createCSVTimelockScript(
        owner.pubkey,
        recipient.pubkey,
        144,
      )

      const result = refreshTimelockUTXO({
        currentUtxo: {
          txId: "a".repeat(64),
          outputIndex: 0,
          amountSats: 50000,
        },
        currentScript: script,
        ownerPrivkey: owner.privkey,
        ownerPubkey: owner.pubkey,
        recipientPubkey: recipient.pubkey,
        ttlBlocks: 288, // Different TTL
        feeRateSatsPerVbyte: 10,
        network: "testnet",
      })

      const decoded = decodeCSVTimelockScript(result.newTimelockScript)
      expect(decoded.ttlBlocks).toBe(288)
    })
  })

  describe("estimateRefreshesRemaining", () => {
    it("estimates correct number of refreshes", async () => {
      const { estimateRefreshesRemaining } = await import(
        "$lib/bitcoin/refresh"
      )

      // 50000 sats, 10 sat/vbyte, ~204 vbytes per refresh = ~2040 sats/refresh
      // (50000 - 10000) / 2040 ≈ 19 refreshes
      const count = estimateRefreshesRemaining(50000, 10)
      expect(count).toBeGreaterThan(15)
      expect(count).toBeLessThan(25)
    })

    it("returns 0 when amount is at minimum", async () => {
      const { estimateRefreshesRemaining } = await import(
        "$lib/bitcoin/refresh"
      )
      const count = estimateRefreshesRemaining(10000, 10)
      expect(count).toBe(0)
    })

    it("returns 0 when fee exceeds available amount", async () => {
      const { estimateRefreshesRemaining } = await import(
        "$lib/bitcoin/refresh"
      )
      const count = estimateRefreshesRemaining(11000, 100)
      expect(count).toBe(0)
    })
  })
})

// ─── Broadcast tests ──────────────────────────────────────────────────────────

describe("Bitcoin CSV Timelock - Broadcast", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("broadcastTransaction", () => {
    it("broadcasts via mempool.space on success", async () => {
      const { broadcastTransaction } = await import("$lib/bitcoin/broadcast")

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => "abc123txid",
      }) as unknown as typeof fetch

      const txId = await broadcastTransaction("deadbeef", "mainnet")
      expect(txId).toBe("abc123txid")

      const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
      expect(mockFetch).toHaveBeenCalledWith(
        "https://mempool.space/api/tx",
        expect.objectContaining({
          method: "POST",
          body: "deadbeef",
        }),
      )

      globalThis.fetch = originalFetch
    })

    it("falls back to blockstream on mempool failure", async () => {
      const { broadcastTransaction } = await import("$lib/bitcoin/broadcast")

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => "Internal error",
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => "fallback_txid",
        }) as unknown as typeof fetch

      const txId = await broadcastTransaction("deadbeef", "mainnet")
      expect(txId).toBe("fallback_txid")

      const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
      expect(mockFetch).toHaveBeenCalledTimes(2)

      globalThis.fetch = originalFetch
    })

    it("throws when all endpoints fail", async () => {
      const { broadcastTransaction } = await import("$lib/bitcoin/broadcast")

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Error",
      }) as unknown as typeof fetch

      await expect(
        broadcastTransaction("deadbeef", "mainnet"),
      ).rejects.toThrow("Failed to broadcast")

      globalThis.fetch = originalFetch
    })

    it("uses testnet endpoints", async () => {
      const { broadcastTransaction } = await import("$lib/bitcoin/broadcast")

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => "testnet_txid",
      }) as unknown as typeof fetch

      await broadcastTransaction("deadbeef", "testnet")

      const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
      expect(mockFetch).toHaveBeenCalledWith(
        "https://mempool.space/testnet/api/tx",
        expect.anything(),
      )

      globalThis.fetch = originalFetch
    })
  })

  describe("getUTXOStatus", () => {
    it("returns confirmed and unspent status", async () => {
      const { getUTXOStatus } = await import("$lib/bitcoin/broadcast")

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: { confirmed: true, block_height: 800000 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ spent: false }),
        }) as unknown as typeof fetch

      const status = await getUTXOStatus("abc123", 0, "mainnet")
      expect(status.confirmed).toBe(true)
      expect(status.blockHeight).toBe(800000)
      expect(status.spent).toBe(false)

      globalThis.fetch = originalFetch
    })

    it("returns spent status with spending txid", async () => {
      const { getUTXOStatus } = await import("$lib/bitcoin/broadcast")

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: { confirmed: true, block_height: 800000 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ spent: true, txid: "spending_txid" }),
        }) as unknown as typeof fetch

      const status = await getUTXOStatus("abc123", 0, "mainnet")
      expect(status.spent).toBe(true)
      expect(status.spentByTxId).toBe("spending_txid")

      globalThis.fetch = originalFetch
    })

    it("falls back to blockstream on mempool failure", async () => {
      const { getUTXOStatus } = await import("$lib/bitcoin/broadcast")

      globalThis.fetch = vi
        .fn()
        // mempool.space fails
        .mockResolvedValueOnce({ ok: false, status: 500 })
        // blockstream succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: { confirmed: true, block_height: 800001 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ spent: false }),
        }) as unknown as typeof fetch

      const status = await getUTXOStatus("abc123", 0, "mainnet")
      expect(status.confirmed).toBe(true)
      expect(status.blockHeight).toBe(800001)

      globalThis.fetch = originalFetch
    })
  })
})

// ─── Fee estimation tests ─────────────────────────────────────────────────────

describe("Bitcoin CSV Timelock - Fee Estimation", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("estimateFeeRate", () => {
    it("returns high priority fee", async () => {
      const { estimateFeeRate } = await import("$lib/bitcoin/fee-estimation")

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          fastestFee: 100,
          halfHourFee: 50,
          hourFee: 30,
          economyFee: 10,
          minimumFee: 1,
        }),
      }) as unknown as typeof fetch

      const rate = await estimateFeeRate("high", "mainnet")
      expect(rate).toBe(100)

      globalThis.fetch = originalFetch
    })

    it("returns medium priority fee", async () => {
      const { estimateFeeRate } = await import("$lib/bitcoin/fee-estimation")

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          fastestFee: 100,
          halfHourFee: 50,
          hourFee: 30,
          economyFee: 10,
          minimumFee: 1,
        }),
      }) as unknown as typeof fetch

      const rate = await estimateFeeRate("medium", "mainnet")
      expect(rate).toBe(50)

      globalThis.fetch = originalFetch
    })

    it("returns low priority fee", async () => {
      const { estimateFeeRate } = await import("$lib/bitcoin/fee-estimation")

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          fastestFee: 100,
          halfHourFee: 50,
          hourFee: 30,
          economyFee: 10,
          minimumFee: 1,
        }),
      }) as unknown as typeof fetch

      const rate = await estimateFeeRate("low", "mainnet")
      expect(rate).toBe(10)

      globalThis.fetch = originalFetch
    })

    it("returns defaults when API fails", async () => {
      const { estimateFeeRate } = await import("$lib/bitcoin/fee-estimation")

      globalThis.fetch = vi
        .fn()
        .mockRejectedValueOnce(
          new Error("Network error"),
        ) as unknown as typeof fetch

      const rate = await estimateFeeRate("medium", "mainnet")
      expect(rate).toBe(20) // Default medium

      globalThis.fetch = originalFetch
    })

    it("uses testnet endpoint", async () => {
      const { estimateFeeRate } = await import("$lib/bitcoin/fee-estimation")

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          fastestFee: 5,
          halfHourFee: 3,
          hourFee: 2,
          economyFee: 1,
          minimumFee: 1,
        }),
      }) as unknown as typeof fetch

      await estimateFeeRate("medium", "testnet")

      const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
      expect(mockFetch).toHaveBeenCalledWith(
        "https://mempool.space/testnet/api/v1/fees/recommended",
      )

      globalThis.fetch = originalFetch
    })
  })

  describe("getAllFeeRates", () => {
    it("returns all fee rates", async () => {
      const { getAllFeeRates } = await import("$lib/bitcoin/fee-estimation")

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          fastestFee: 100,
          halfHourFee: 50,
          hourFee: 30,
          economyFee: 10,
          minimumFee: 1,
        }),
      }) as unknown as typeof fetch

      const rates = await getAllFeeRates("mainnet")
      expect(rates.high).toBe(100)
      expect(rates.medium).toBe(50)
      expect(rates.low).toBe(10)

      globalThis.fetch = originalFetch
    })

    it("returns defaults when API fails", async () => {
      const { getAllFeeRates } = await import("$lib/bitcoin/fee-estimation")

      globalThis.fetch = vi
        .fn()
        .mockRejectedValueOnce(
          new Error("Network error"),
        ) as unknown as typeof fetch

      const rates = await getAllFeeRates("mainnet")
      expect(rates.high).toBe(50)
      expect(rates.medium).toBe(20)
      expect(rates.low).toBe(5)

      globalThis.fetch = originalFetch
    })
  })
})

// ─── Integration tests ────────────────────────────────────────────────────────

describe("Bitcoin CSV Timelock - Integration", () => {
  it("full lifecycle: create → pre-sign → refresh", async () => {
    const { createTimelockUTXO, createPreSignedRecipientTx } = await import(
      "$lib/bitcoin/transaction"
    )
    const { refreshTimelockUTXO } = await import("$lib/bitcoin/refresh")
    const { decodeCSVTimelockScript, createP2WSHAddress } = await import(
      "$lib/bitcoin/script"
    )

    const p2wpkh = btc.p2wpkh(owner.pubkey, btc.TEST_NETWORK)
    const recipientP2wpkh = btc.p2wpkh(recipient.pubkey, btc.TEST_NETWORK)

    // Step 1: Create initial timelock UTXO
    const initial = createTimelockUTXO({
      ownerPrivkey: owner.privkey,
      ownerPubkey: owner.pubkey,
      recipientPubkey: recipient.pubkey,
      ttlBlocks: 4320, // 30 days
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

    expect(initial.txId).toBeTruthy()
    const decoded1 = decodeCSVTimelockScript(initial.timelockScript)
    expect(decoded1.ttlBlocks).toBe(4320)

    // Verify address generation
    const address = createP2WSHAddress(initial.timelockScript, "testnet")
    expect(address).toMatch(/^tb1q/)

    // Step 2: Create pre-signed recipient tx
    const preSigned = createPreSignedRecipientTx({
      timelockUtxo: {
        txId: initial.txId,
        outputIndex: initial.outputIndex,
        amountSats: 100000,
      },
      timelockScript: initial.timelockScript,
      recipientPrivkey: recipient.privkey,
      recipientAddress: recipientP2wpkh.address!,
      ttlBlocks: 4320,
      symmetricKeyK: new Uint8Array(32).fill(0xcc),
      nostrEventId: "dd".repeat(32),
      feeRateSatsPerVbyte: 5,
      network: "testnet",
    })

    expect(preSigned.txHex).toBeTruthy()

    // Step 3: Owner checks in (refresh)
    const refreshed = refreshTimelockUTXO({
      currentUtxo: {
        txId: initial.txId,
        outputIndex: initial.outputIndex,
        amountSats: 100000,
      },
      currentScript: initial.timelockScript,
      ownerPrivkey: owner.privkey,
      ownerPubkey: owner.pubkey,
      recipientPubkey: recipient.pubkey,
      ttlBlocks: 4320,
      feeRateSatsPerVbyte: 5,
      network: "testnet",
    })

    expect(refreshed.newTxId).toBeTruthy()
    expect(refreshed.newTxId).not.toBe(initial.txId)

    const decoded2 = decodeCSVTimelockScript(refreshed.newTimelockScript)
    expect(decoded2.ttlBlocks).toBe(4320)

    // Verify the refreshed UTXO has less sats (fee deducted)
    const rawRefresh = btc.RawTx.decode(hex.decode(refreshed.txHex))
    const newAmount = Number(rawRefresh.outputs[0].amount)
    expect(newAmount).toBeLessThan(100000)
    expect(newAmount).toBeGreaterThan(90000) // Fee should be small at 5 sat/vbyte
  })

  it("full lifecycle: create → pre-sign → refresh → re-create pre-signed tx", async () => {
    const { createTimelockUTXO, createPreSignedRecipientTx } = await import(
      "$lib/bitcoin/transaction"
    )
    const { refreshTimelockUTXO } = await import("$lib/bitcoin/refresh")

    const p2wpkh = btc.p2wpkh(owner.pubkey, btc.TEST_NETWORK)
    const recipientP2wpkh = btc.p2wpkh(recipient.pubkey, btc.TEST_NETWORK)
    const symmetricKeyK = new Uint8Array(32).fill(0xcc)
    const nostrEventId = "dd".repeat(32)

    // Step 1: Create initial timelock UTXO
    const initial = createTimelockUTXO({
      ownerPrivkey: owner.privkey,
      ownerPubkey: owner.pubkey,
      recipientPubkey: recipient.pubkey,
      ttlBlocks: 4320,
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

    // Step 2: Create initial pre-signed recipient tx
    const preSigned1 = createPreSignedRecipientTx({
      timelockUtxo: {
        txId: initial.txId,
        outputIndex: initial.outputIndex,
        amountSats: 100000,
      },
      timelockScript: initial.timelockScript,
      recipientPrivkey: recipient.privkey,
      recipientAddress: recipientP2wpkh.address!,
      ttlBlocks: 4320,
      symmetricKeyK,
      nostrEventId,
      feeRateSatsPerVbyte: 5,
      network: "testnet",
    })
    expect(preSigned1.txHex).toBeTruthy()

    // Step 3: Owner checks in (refresh)
    const refreshed = refreshTimelockUTXO({
      currentUtxo: {
        txId: initial.txId,
        outputIndex: initial.outputIndex,
        amountSats: 100000,
      },
      currentScript: initial.timelockScript,
      ownerPrivkey: owner.privkey,
      ownerPubkey: owner.pubkey,
      recipientPubkey: recipient.pubkey,
      ttlBlocks: 4320,
      feeRateSatsPerVbyte: 5,
      network: "testnet",
    })

    const rawRefresh = btc.RawTx.decode(hex.decode(refreshed.txHex))
    const newAmount = Number(rawRefresh.outputs[0].amount)

    // Step 4: Recreate pre-signed tx for the NEW UTXO (this is the critical fix)
    const preSigned2 = createPreSignedRecipientTx({
      timelockUtxo: {
        txId: refreshed.newTxId,
        outputIndex: refreshed.newOutputIndex,
        amountSats: newAmount,
      },
      timelockScript: refreshed.newTimelockScript,
      recipientPrivkey: recipient.privkey,
      recipientAddress: recipientP2wpkh.address!,
      ttlBlocks: 4320,
      symmetricKeyK,
      nostrEventId,
      feeRateSatsPerVbyte: 5,
      network: "testnet",
    })

    // Pre-signed tx must exist after refresh
    expect(preSigned2.txHex).toBeTruthy()
    // Must be different from the original (different UTXO input)
    expect(preSigned2.txHex).not.toBe(preSigned1.txHex)

    // Verify the new pre-signed tx structure
    const rawPreSigned = btc.RawTx.decode(hex.decode(preSigned2.txHex))
    // Should have 2 outputs: OP_RETURN + recipient
    expect(rawPreSigned.outputs.length).toBe(2)
    // First output should be OP_RETURN (amount = 0)
    expect(rawPreSigned.outputs[0].amount).toBe(0n)
    // Input should have CSV sequence
    expect(rawPreSigned.inputs[0].sequence).toBe(4320)
    // Should have witness data
    expect(rawPreSigned.witnesses[0].length).toBe(3)
  })

  it("multiple sequential refreshes", async () => {
    const { refreshTimelockUTXO, estimateRefreshesRemaining } = await import(
      "$lib/bitcoin/refresh"
    )
    const { createCSVTimelockScript } = await import("$lib/bitcoin/script")

    let currentScript = createCSVTimelockScript(
      owner.pubkey,
      recipient.pubkey,
      144,
    )
    let currentTxId = "a".repeat(64)
    let currentAmount = 50000

    const feeRate = 5
    const expectedRefreshes = estimateRefreshesRemaining(currentAmount, feeRate)
    expect(expectedRefreshes).toBeGreaterThan(0)

    // Do 3 sequential refreshes
    for (let i = 0; i < 3; i++) {
      const result = refreshTimelockUTXO({
        currentUtxo: {
          txId: currentTxId,
          outputIndex: 0,
          amountSats: currentAmount,
        },
        currentScript,
        ownerPrivkey: owner.privkey,
        ownerPubkey: owner.pubkey,
        recipientPubkey: recipient.pubkey,
        ttlBlocks: 144,
        feeRateSatsPerVbyte: feeRate,
        network: "testnet",
      })

      // Update for next iteration
      const rawTx = btc.RawTx.decode(hex.decode(result.txHex))
      currentAmount = Number(rawTx.outputs[0].amount)
      currentTxId = result.newTxId
      currentScript = result.newTimelockScript

      expect(currentAmount).toBeGreaterThanOrEqual(10000)
    }

    // Amount should have decreased
    expect(currentAmount).toBeLessThan(50000)
  })
})
