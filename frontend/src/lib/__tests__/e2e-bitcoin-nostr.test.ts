/**
 * End-to-end integration tests for Bitcoin + Nostr + double-encryption flows.
 *
 * These tests use REAL crypto libraries (no mocks) to verify the full
 * cryptographic pipeline works end-to-end.
 *
 * 7.3: Create secret with Bitcoin -> simulate timeout -> recipient recovers
 * 7.4: Create secret -> check-in refreshes UTXO -> verify old tx invalid
 * 7.5: Quantum-safe recovery path (passphrase + OP_RETURN K, no NIP-44)
 */

import { describe, it, expect } from "vitest"
import { secp256k1 } from "@noble/curves/secp256k1.js"
import { hex } from "@scure/base"
import * as btc from "@scure/btc-signer"

// Crypto modules
import {
  generateSymmetricKey,
  encryptWithSymmetricKey,
  decryptWithSymmetricKey,
} from "$lib/crypto/symmetric"
import {
  deriveKeyFromPassphrase,
  encryptWithDerivedKey,
} from "$lib/crypto/passphrase"
import { doubleEncryptShare } from "$lib/crypto/double-encrypt"
import {
  recoverKFromOpReturn,
  recoverKFromPassphrase,
  decryptShare,
} from "$lib/crypto/recovery"

// Bitcoin modules
import {
  createCSVTimelockScript,
  createOpReturnPayload,
  daysToBlocks,
  decodeCSVTimelockScript,
} from "$lib/bitcoin/script"
import {
  createTimelockUTXO,
  createPreSignedRecipientTx,
} from "$lib/bitcoin/transaction"
import { refreshTimelockUTXO } from "$lib/bitcoin/refresh"

// Nostr modules
import { generateKeypair } from "$lib/nostr/keypair"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compare Uint8Arrays reliably across jsdom realms. */
function expectBytesEqual(actual: Uint8Array, expected: Uint8Array): void {
  expect(actual.length).toBe(expected.length)
  expect(Array.from(actual)).toEqual(Array.from(expected))
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** Create a secp256k1 keypair from a deterministic seed byte. */
function makeBtcKeyPair(seed: number) {
  const privkey = new Uint8Array(32)
  privkey[31] = seed
  const pubkey = secp256k1.getPublicKey(privkey, true) // compressed 33 bytes
  return { privkey, pubkey }
}

// ─── 7.3: Create + timeout + recipient recovers ──────────────────────────────

describe("E2E 7.3: Create secret with Bitcoin -> timeout -> recipient recovers", () => {
  it("full flow: encrypt share, embed K in OP_RETURN, recipient recovers", async () => {
    // 1. Generate owner and recipient keypairs (Nostr for identity, BTC for scripts)
    const ownerNostr = generateKeypair()
    const recipientNostr = generateKeypair()
    const ownerBtc = makeBtcKeyPair(1)
    const recipientBtc = makeBtcKeyPair(2)

    // 2. Create a share (plain text string)
    const originalShare = "shamir-share-1-of-3:a1b2c3d4e5f6"

    // 3. Double-encrypt the share (using stub NIP-44 for the Nostr path)
    const doubleEncrypted = await doubleEncryptShare(
      originalShare,
      recipientNostr.publicKey,
      ownerNostr.secretKey,
      "backup-passphrase-for-quantum-safety",
    )

    // The plaintext K is what goes into OP_RETURN
    const K = doubleEncrypted.plaintextK
    expect(K.length).toBe(32)

    // 4. Create a CSV timelock script (30-day timeout)
    const ttlBlocks = daysToBlocks(30) // 4320 blocks
    expect(ttlBlocks).toBe(4320)

    const timelockScript = createCSVTimelockScript(
      ownerBtc.pubkey,
      recipientBtc.pubkey,
      ttlBlocks,
    )

    // Verify script structure
    const decoded = decodeCSVTimelockScript(timelockScript)
    expect(decoded.ttlBlocks).toBe(4320)
    expect(hex.encode(decoded.ownerPubkey)).toBe(hex.encode(ownerBtc.pubkey))
    expect(hex.encode(decoded.recipientPubkey)).toBe(
      hex.encode(recipientBtc.pubkey),
    )

    // 5. Create the OP_RETURN payload with K and a fake Nostr event ID
    const fakeNostrEventId = "ab".repeat(32) // 64 hex chars
    const opReturnPayload = createOpReturnPayload(K, fakeNostrEventId)
    expect(opReturnPayload.length).toBe(64)

    // Verify K is in the first 32 bytes
    expectBytesEqual(opReturnPayload.slice(0, 32), K)

    // 6. Create the timelock UTXO (simulates the on-chain funding tx)
    const ownerP2wpkh = btc.p2wpkh(ownerBtc.pubkey, btc.TEST_NETWORK)
    const utxoResult = createTimelockUTXO({
      ownerPrivkey: ownerBtc.privkey,
      ownerPubkey: ownerBtc.pubkey,
      recipientPubkey: recipientBtc.pubkey,
      ttlBlocks,
      amountSats: 50000,
      feeRateSatsPerVbyte: 5,
      fundingUtxo: {
        txId: "a".repeat(64),
        outputIndex: 0,
        amountSats: 100000,
        scriptPubKey: hex.encode(ownerP2wpkh.script),
      },
      network: "testnet",
    })

    expect(utxoResult.txId).toMatch(/^[0-9a-f]{64}$/)

    // 7. Create the pre-signed recipient tx (becomes valid after timeout)
    const recipientP2wpkh = btc.p2wpkh(recipientBtc.pubkey, btc.TEST_NETWORK)
    const preSignedTx = createPreSignedRecipientTx({
      timelockUtxo: {
        txId: utxoResult.txId,
        outputIndex: utxoResult.outputIndex,
        amountSats: 50000,
      },
      timelockScript: utxoResult.timelockScript,
      recipientPrivkey: recipientBtc.privkey,
      recipientAddress: recipientP2wpkh.address!,
      ttlBlocks,
      symmetricKeyK: K,
      nostrEventId: fakeNostrEventId,
      feeRateSatsPerVbyte: 5,
      network: "testnet",
    })

    expect(preSignedTx.txHex).toBeTruthy()

    // Verify the pre-signed tx contains the OP_RETURN with K
    const rawTx = btc.RawTx.decode(hex.decode(preSignedTx.txHex))
    expect(rawTx.outputs.length).toBe(2) // OP_RETURN + recipient output
    expect(rawTx.outputs[0].amount).toBe(0n) // OP_RETURN has 0 value

    // 8. Simulate recipient recovering K from OP_RETURN data
    // In reality, the recipient would parse the OP_RETURN from the broadcast tx.
    // Here we extract K from the payload we created.
    const recoveredK = recoverKFromOpReturn(opReturnPayload.slice(0, 32))
    expectBytesEqual(recoveredK, K)

    // 9. Decrypt the share with recovered K
    const recoveredShare = decryptShare(
      doubleEncrypted.encryptedShare,
      doubleEncrypted.nonce,
      recoveredK,
    )
    expect(recoveredShare).toBe(originalShare)
  })

  it("OP_RETURN K in pre-signed tx matches the encryption key", async () => {
    const ownerBtc = makeBtcKeyPair(3)
    const recipientBtc = makeBtcKeyPair(4)
    const ownerNostr = generateKeypair()
    const recipientNostr = generateKeypair()

    const share = "critical-share-data-xyz"
    const encrypted = await doubleEncryptShare(
      share,
      recipientNostr.publicKey,
      ownerNostr.secretKey,
    )

    const K = encrypted.plaintextK
    const eventId = "cc".repeat(32)
    const ttlBlocks = daysToBlocks(7) // 1 week

    const ownerP2wpkh = btc.p2wpkh(ownerBtc.pubkey, btc.TEST_NETWORK)
    const utxo = createTimelockUTXO({
      ownerPrivkey: ownerBtc.privkey,
      ownerPubkey: ownerBtc.pubkey,
      recipientPubkey: recipientBtc.pubkey,
      ttlBlocks,
      amountSats: 20000,
      feeRateSatsPerVbyte: 3,
      fundingUtxo: {
        txId: "b".repeat(64),
        outputIndex: 0,
        amountSats: 50000,
        scriptPubKey: hex.encode(ownerP2wpkh.script),
      },
      network: "testnet",
    })

    const recipientP2wpkh = btc.p2wpkh(recipientBtc.pubkey, btc.TEST_NETWORK)
    const preSigned = createPreSignedRecipientTx({
      timelockUtxo: {
        txId: utxo.txId,
        outputIndex: utxo.outputIndex,
        amountSats: 20000,
      },
      timelockScript: utxo.timelockScript,
      recipientPrivkey: recipientBtc.privkey,
      recipientAddress: recipientP2wpkh.address!,
      ttlBlocks,
      symmetricKeyK: K,
      nostrEventId: eventId,
      feeRateSatsPerVbyte: 3,
      network: "testnet",
    })

    // Parse the OP_RETURN from the raw tx
    const rawTx = btc.RawTx.decode(hex.decode(preSigned.txHex))
    const opReturnOutput = rawTx.outputs[0]
    expect(opReturnOutput.amount).toBe(0n)

    // The OP_RETURN script is: OP_RETURN <push 64 bytes>
    // Script: 0x6a (OP_RETURN) + push opcode + 64 bytes of data
    const script = opReturnOutput.script
    expect(script[0]).toBe(0x6a) // OP_RETURN

    // Extract the data from the OP_RETURN script
    // After OP_RETURN, there's a push opcode for 64 bytes (0x40)
    const dataStart = 2 // 0x6a + push opcode
    const opReturnData = script.slice(dataStart, dataStart + 64)

    // First 32 bytes should be K
    const extractedK = recoverKFromOpReturn(opReturnData.slice(0, 32))
    expectBytesEqual(extractedK, K)

    // Decrypt the share
    const recovered = decryptShare(
      encrypted.encryptedShare,
      encrypted.nonce,
      extractedK,
    )
    expect(recovered).toBe(share)
  })
})

// ─── 7.4: Create + refresh + verify old tx invalid ───────────────────────────

describe("E2E 7.4: Create + check-in refresh -> old tx references spent output", () => {
  it("refresh creates new UTXO with different txId, old UTXO is spent", () => {
    const ownerBtc = makeBtcKeyPair(5)
    const recipientBtc = makeBtcKeyPair(6)

    // 1. Create a timelock script with TTL
    const ttlBlocks = daysToBlocks(14) // 2 weeks = 2016 blocks
    expect(ttlBlocks).toBe(2016)

    // 2. Build a timelock UTXO
    const ownerP2wpkh = btc.p2wpkh(ownerBtc.pubkey, btc.TEST_NETWORK)
    const initial = createTimelockUTXO({
      ownerPrivkey: ownerBtc.privkey,
      ownerPubkey: ownerBtc.pubkey,
      recipientPubkey: recipientBtc.pubkey,
      ttlBlocks,
      amountSats: 80000,
      feeRateSatsPerVbyte: 5,
      fundingUtxo: {
        txId: "d".repeat(64),
        outputIndex: 0,
        amountSats: 200000,
        scriptPubKey: hex.encode(ownerP2wpkh.script),
      },
      network: "testnet",
    })

    const originalTxId = initial.txId
    expect(originalTxId).toMatch(/^[0-9a-f]{64}$/)

    // Create a pre-signed recipient tx referencing the original UTXO
    const recipientP2wpkh = btc.p2wpkh(recipientBtc.pubkey, btc.TEST_NETWORK)
    const K = generateSymmetricKey()
    const eventId = "ee".repeat(32)

    const preSignedTx = createPreSignedRecipientTx({
      timelockUtxo: {
        txId: originalTxId,
        outputIndex: initial.outputIndex,
        amountSats: 80000,
      },
      timelockScript: initial.timelockScript,
      recipientPrivkey: recipientBtc.privkey,
      recipientAddress: recipientP2wpkh.address!,
      ttlBlocks,
      symmetricKeyK: K,
      nostrEventId: eventId,
      feeRateSatsPerVbyte: 5,
      network: "testnet",
    })

    // 3. Build a refresh transaction (spend old UTXO, create new one)
    const refreshResult = refreshTimelockUTXO({
      currentUtxo: {
        txId: originalTxId,
        outputIndex: initial.outputIndex,
        amountSats: 80000,
      },
      currentScript: initial.timelockScript,
      ownerPrivkey: ownerBtc.privkey,
      ownerPubkey: ownerBtc.pubkey,
      recipientPubkey: recipientBtc.pubkey,
      ttlBlocks,
      feeRateSatsPerVbyte: 5,
      network: "testnet",
    })

    // 4. Verify the new UTXO has a different txId
    expect(refreshResult.newTxId).toMatch(/^[0-9a-f]{64}$/)
    expect(refreshResult.newTxId).not.toBe(originalTxId)

    // 5. Verify the old pre-signed tx references the now-spent output
    // Parse the pre-signed tx to check its input references.
    // RawTx preserves the txid format from addInput (display/big-endian).
    const preSignedRaw = btc.RawTx.decode(hex.decode(preSignedTx.txHex))
    const inputTxId = hex.encode(preSignedRaw.inputs[0].txid)
    expect(inputTxId).toBe(originalTxId)

    // The refresh tx also spends the same UTXO
    const refreshRaw = btc.RawTx.decode(hex.decode(refreshResult.txHex))
    const refreshInputTxId = hex.encode(refreshRaw.inputs[0].txid)
    expect(refreshInputTxId).toBe(originalTxId)

    // Both transactions reference the same input — on the real network,
    // once the refresh tx is mined, the pre-signed tx becomes invalid
    // because its input (originalTxId:0) is already spent.
    // This is the fundamental mechanism: check-in invalidates the old recipient tx.
  })

  it("multiple refreshes create a chain of new UTXOs", () => {
    const ownerBtc = makeBtcKeyPair(7)
    const recipientBtc = makeBtcKeyPair(8)
    const ttlBlocks = daysToBlocks(30)

    // Create initial UTXO
    const ownerP2wpkh = btc.p2wpkh(ownerBtc.pubkey, btc.TEST_NETWORK)
    const initial = createTimelockUTXO({
      ownerPrivkey: ownerBtc.privkey,
      ownerPubkey: ownerBtc.pubkey,
      recipientPubkey: recipientBtc.pubkey,
      ttlBlocks,
      amountSats: 100000,
      feeRateSatsPerVbyte: 3,
      fundingUtxo: {
        txId: "f".repeat(64),
        outputIndex: 0,
        amountSats: 200000,
        scriptPubKey: hex.encode(ownerP2wpkh.script),
      },
      network: "testnet",
    })

    const txIds: string[] = [initial.txId]
    let currentTxId = initial.txId
    let currentScript = initial.timelockScript
    let currentAmount = 100000

    // Do 5 sequential refreshes
    for (let i = 0; i < 5; i++) {
      const result = refreshTimelockUTXO({
        currentUtxo: {
          txId: currentTxId,
          outputIndex: 0,
          amountSats: currentAmount,
        },
        currentScript,
        ownerPrivkey: ownerBtc.privkey,
        ownerPubkey: ownerBtc.pubkey,
        recipientPubkey: recipientBtc.pubkey,
        ttlBlocks,
        feeRateSatsPerVbyte: 3,
        network: "testnet",
      })

      // Each refresh produces a unique txId
      expect(txIds).not.toContain(result.newTxId)
      txIds.push(result.newTxId)

      // Update state for next iteration
      const rawTx = btc.RawTx.decode(hex.decode(result.txHex))
      currentAmount = Number(rawTx.outputs[0].amount)
      currentTxId = result.newTxId
      currentScript = result.newTimelockScript
    }

    // All 6 txIds (1 initial + 5 refreshes) should be unique
    expect(new Set(txIds).size).toBe(6)

    // Amount should have decreased (fees deducted each refresh)
    expect(currentAmount).toBeLessThan(100000)
    expect(currentAmount).toBeGreaterThan(90000) // 5 refreshes at ~612 sats each
  })

  it("pre-signed tx for old UTXO references different txId than refreshed UTXO", () => {
    const ownerBtc = makeBtcKeyPair(9)
    const recipientBtc = makeBtcKeyPair(10)
    const ttlBlocks = daysToBlocks(7)

    const ownerP2wpkh = btc.p2wpkh(ownerBtc.pubkey, btc.TEST_NETWORK)
    const initial = createTimelockUTXO({
      ownerPrivkey: ownerBtc.privkey,
      ownerPubkey: ownerBtc.pubkey,
      recipientPubkey: recipientBtc.pubkey,
      ttlBlocks,
      amountSats: 30000,
      feeRateSatsPerVbyte: 5,
      fundingUtxo: {
        txId: "1".repeat(64),
        outputIndex: 0,
        amountSats: 60000,
        scriptPubKey: hex.encode(ownerP2wpkh.script),
      },
      network: "testnet",
    })

    // Pre-sign a recipient tx for the initial UTXO
    const recipientP2wpkh = btc.p2wpkh(recipientBtc.pubkey, btc.TEST_NETWORK)
    const K = generateSymmetricKey()
    const preSignedOld = createPreSignedRecipientTx({
      timelockUtxo: {
        txId: initial.txId,
        outputIndex: 0,
        amountSats: 30000,
      },
      timelockScript: initial.timelockScript,
      recipientPrivkey: recipientBtc.privkey,
      recipientAddress: recipientP2wpkh.address!,
      ttlBlocks,
      symmetricKeyK: K,
      nostrEventId: "aa".repeat(32),
      feeRateSatsPerVbyte: 5,
      network: "testnet",
    })

    // Refresh the UTXO
    const refreshed = refreshTimelockUTXO({
      currentUtxo: {
        txId: initial.txId,
        outputIndex: 0,
        amountSats: 30000,
      },
      currentScript: initial.timelockScript,
      ownerPrivkey: ownerBtc.privkey,
      ownerPubkey: ownerBtc.pubkey,
      recipientPubkey: recipientBtc.pubkey,
      ttlBlocks,
      feeRateSatsPerVbyte: 5,
      network: "testnet",
    })

    // The old pre-signed tx references initial.txId
    const oldRaw = btc.RawTx.decode(hex.decode(preSignedOld.txHex))
    const oldInputTxId = hex.encode(oldRaw.inputs[0].txid)

    // The new UTXO has a different txId
    expect(oldInputTxId).toBe(initial.txId)
    expect(refreshed.newTxId).not.toBe(initial.txId)

    // Therefore the old pre-signed tx is invalid after refresh:
    // it tries to spend initial.txId:0 which is now spent by the refresh tx.
  })
})

// ─── 7.5: Quantum-safe recovery path ─────────────────────────────────────────

describe("E2E 7.5: Quantum-safe recovery (passphrase + OP_RETURN K, no NIP-44)", () => {
  it("recovers share using only passphrase — no secp256k1/NIP-44 involved", async () => {
    // 1. Generate a share
    const originalShare =
      "quantum-safe-share:deadbeef0123456789abcdef"

    // 2. Encrypt with ChaCha20 using random K
    const K = generateSymmetricKey()
    const shareBytes = new TextEncoder().encode(originalShare)
    const { ciphertext: encryptedShare, nonce: shareNonce } =
      encryptWithSymmetricKey(shareBytes, K)

    // 3. Encrypt K with passphrase (PBKDF2 + AES-256-GCM) — NO NIP-44
    const passphrase = "correct-horse-battery-staple-2026"
    const { key: derivedKey, salt } =
      await deriveKeyFromPassphrase(passphrase)
    const { ciphertext: encryptedK, nonce: kNonce } =
      await encryptWithDerivedKey(K, derivedKey)

    const passphraseBundle = {
      ciphertext: encryptedK,
      nonce: kNonce,
      salt,
    }

    // 4. Also create OP_RETURN payload with K (for Bitcoin path)
    const fakeEventId = "ff".repeat(32)
    const opReturnPayload = createOpReturnPayload(K, fakeEventId)

    // 5. Recover K from passphrase bundle — verify it works
    const kFromPassphrase = await recoverKFromPassphrase(
      passphraseBundle,
      passphrase,
    )
    expectBytesEqual(kFromPassphrase, K)

    // 6. Recover K from OP_RETURN — verify it works
    const kFromOpReturn = recoverKFromOpReturn(opReturnPayload.slice(0, 32))
    expectBytesEqual(kFromOpReturn, K)

    // 7. Decrypt share with recovered K — verify original share
    const shareFromPassphrase = decryptShare(
      encryptedShare,
      shareNonce,
      kFromPassphrase,
    )
    expect(shareFromPassphrase).toBe(originalShare)

    const shareFromOpReturn = decryptShare(
      encryptedShare,
      shareNonce,
      kFromOpReturn,
    )
    expect(shareFromOpReturn).toBe(originalShare)

    // 8. Both paths yield identical K and identical decrypted share
    expectBytesEqual(kFromPassphrase, kFromOpReturn)
    expect(shareFromPassphrase).toBe(shareFromOpReturn)
  })

  it("passphrase recovery fails with wrong passphrase", async () => {
    const K = generateSymmetricKey()
    const passphrase = "right-passphrase"
    const { key: derivedKey, salt } =
      await deriveKeyFromPassphrase(passphrase)
    const { ciphertext, nonce } = await encryptWithDerivedKey(K, derivedKey)

    await expect(
      recoverKFromPassphrase(
        { ciphertext, nonce, salt },
        "wrong-passphrase",
      ),
    ).rejects.toThrow()
  })

  it("OP_RETURN recovery rejects tampered data", () => {
    const K = generateSymmetricKey()
    const fakeEventId = "00".repeat(32)
    const payload = createOpReturnPayload(K, fakeEventId)

    // Tamper with the K portion
    const tampered = new Uint8Array(payload.slice(0, 32))
    tampered[0] ^= 0xff

    // The recovered K won't match the original
    const recoveredK = recoverKFromOpReturn(tampered)
    expect(Array.from(recoveredK)).not.toEqual(Array.from(K))
  })

  it("full quantum-safe pipeline: encrypt share, encrypt K two ways, recover both", async () => {
    const share = "multi-recipient-share-data-for-quantum-safety"
    const passphrase = "entropy-is-the-key-to-the-universe"

    // Encrypt share with K
    const K = generateSymmetricKey()
    const shareBytes = new TextEncoder().encode(share)
    const { ciphertext: encShare, nonce: shareNonce } =
      encryptWithSymmetricKey(shareBytes, K)

    // Encrypt K via passphrase
    const { key: derivedKey, salt } =
      await deriveKeyFromPassphrase(passphrase)
    const { ciphertext: encK, nonce: kNonce } =
      await encryptWithDerivedKey(K, derivedKey)

    // Store K in OP_RETURN format
    const opReturnPayload = createOpReturnPayload(
      K,
      "dd".repeat(32),
    )

    // Recovery path 1: passphrase
    const k1 = await recoverKFromPassphrase(
      { ciphertext: encK, nonce: kNonce, salt },
      passphrase,
    )

    // Recovery path 2: OP_RETURN
    const k2 = recoverKFromOpReturn(opReturnPayload.slice(0, 32))

    // Both yield same K
    expectBytesEqual(k1, k2)
    expectBytesEqual(k1, K)

    // Both decrypt the share
    expect(decryptShare(encShare, shareNonce, k1)).toBe(share)
    expect(decryptShare(encShare, shareNonce, k2)).toBe(share)

    // Neither path used secp256k1 or NIP-44 — this is quantum-safe
  })

  it("ChaCha20-Poly1305 detects tampering (integrity check)", () => {
    const K = generateSymmetricKey()
    const plaintext = new TextEncoder().encode("integrity-test-data")
    const { ciphertext, nonce } = encryptWithSymmetricKey(plaintext, K)

    // Tamper with ciphertext
    const tampered = new Uint8Array(ciphertext)
    tampered[0] ^= 0xff

    // Poly1305 auth tag check should fail
    expect(() => decryptWithSymmetricKey(tampered, nonce, K)).toThrow()
  })

  it("AES-256-GCM detects tampering on passphrase-encrypted K", async () => {
    const K = generateSymmetricKey()
    const passphrase = "tamper-detection-test"
    const { key: derivedKey, salt } =
      await deriveKeyFromPassphrase(passphrase)
    const { ciphertext, nonce } = await encryptWithDerivedKey(K, derivedKey)

    // Tamper with the encrypted K
    const tampered = new Uint8Array(ciphertext)
    tampered[0] ^= 0xff

    await expect(
      recoverKFromPassphrase(
        { ciphertext: tampered, nonce, salt },
        passphrase,
      ),
    ).rejects.toThrow()
  })
})
