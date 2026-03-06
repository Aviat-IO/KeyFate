/**
 * Tests for the double-encryption layer
 *
 * Covers:
 * - symmetric.ts: ChaCha20-Poly1305 encrypt/decrypt
 * - passphrase.ts: PBKDF2 key derivation + AES-256-GCM
 * - double-encrypt.ts: orchestration of double encryption
 * - recovery.ts: all three K recovery paths + share decryption
 */

import { describe, it, expect } from "vitest"

/**
 * Helper to compare Uint8Arrays reliably in jsdom.
 * Vitest's toEqual can fail on Uint8Arrays from different realms.
 */
function expectBytesEqual(actual: Uint8Array, expected: Uint8Array): void {
  expect(actual.length).toBe(expected.length)
  expect(Array.from(actual)).toEqual(Array.from(expected))
}
import {
  generateSymmetricKey,
  encryptWithSymmetricKey,
  decryptWithSymmetricKey,
} from "$lib/crypto/symmetric"
import {
  deriveKeyFromPassphrase,
  encryptWithDerivedKey,
  decryptWithDerivedKey,
} from "$lib/crypto/passphrase"
import {
  doubleEncryptShare,
  type Nip44Ops,
} from "$lib/crypto/double-encrypt"
import {
  recoverKFromNostr,
  recoverKFromPassphrase,
  recoverKFromOpReturn,
  decryptShare,
} from "$lib/crypto/recovery"

// ─── symmetric.ts ────────────────────────────────────────────────────────────

describe("symmetric (ChaCha20-Poly1305)", () => {
  describe("generateSymmetricKey", () => {
    it("returns a 32-byte Uint8Array", () => {
      const key = generateSymmetricKey()
      expect(key).toBeInstanceOf(Uint8Array)
      expect(key.length).toBe(32)
    })

    it("generates unique keys each call", () => {
      const k1 = generateSymmetricKey()
      const k2 = generateSymmetricKey()
      expect(Array.from(k1)).not.toEqual(Array.from(k2))
    })
  })

  describe("encryptWithSymmetricKey", () => {
    it("returns ciphertext and 12-byte nonce", () => {
      const key = generateSymmetricKey()
      const plaintext = new TextEncoder().encode("hello")
      const { ciphertext, nonce } = encryptWithSymmetricKey(plaintext, key)

      expect(ciphertext).toBeInstanceOf(Uint8Array)
      expect(nonce).toBeInstanceOf(Uint8Array)
      expect(nonce.length).toBe(12)
      // Ciphertext = plaintext + 16-byte Poly1305 tag
      expect(ciphertext.length).toBe(plaintext.length + 16)
    })

    it("produces different ciphertext for same plaintext (random nonce)", () => {
      const key = generateSymmetricKey()
      const plaintext = new TextEncoder().encode("same data")
      const r1 = encryptWithSymmetricKey(plaintext, key)
      const r2 = encryptWithSymmetricKey(plaintext, key)

      expect(Array.from(r1.nonce)).not.toEqual(Array.from(r2.nonce))
      expect(Array.from(r1.ciphertext)).not.toEqual(Array.from(r2.ciphertext))
    })

    it("throws on invalid key length", () => {
      const badKey = new Uint8Array(16)
      const plaintext = new TextEncoder().encode("test")
      expect(() => encryptWithSymmetricKey(plaintext, badKey)).toThrow(
        "Key must be 32 bytes",
      )
    })

    it("handles empty plaintext", () => {
      const key = generateSymmetricKey()
      const plaintext = new Uint8Array(0)
      const { ciphertext } = encryptWithSymmetricKey(plaintext, key)
      // Empty plaintext still has 16-byte auth tag
      expect(ciphertext.length).toBe(16)
    })
  })

  describe("decryptWithSymmetricKey", () => {
    it("round-trips plaintext correctly", () => {
      const key = generateSymmetricKey()
      const original = new TextEncoder().encode("round trip test")
      const { ciphertext, nonce } = encryptWithSymmetricKey(original, key)
      const decrypted = decryptWithSymmetricKey(ciphertext, nonce, key)

      expectBytesEqual(decrypted, original)
    })

    it("round-trips unicode text", () => {
      const key = generateSymmetricKey()
      const original = new TextEncoder().encode("Emoji: \u{1F512}\u{1F511} CJK: \u4F60\u597D")
      const { ciphertext, nonce } = encryptWithSymmetricKey(original, key)
      const decrypted = decryptWithSymmetricKey(ciphertext, nonce, key)

      expect(new TextDecoder().decode(decrypted)).toBe("Emoji: \u{1F512}\u{1F511} CJK: \u4F60\u597D")
    })

    it("round-trips large data", () => {
      const key = generateSymmetricKey()
      // jsdom limits crypto.getRandomValues to 65536 bytes, so fill deterministically
      const original = new Uint8Array(100_000)
      for (let i = 0; i < original.length; i++) {
        original[i] = i % 256
      }
      const { ciphertext, nonce } = encryptWithSymmetricKey(original, key)
      const decrypted = decryptWithSymmetricKey(ciphertext, nonce, key)

      expectBytesEqual(decrypted, original)
    })

    it("throws on wrong key", () => {
      const key1 = generateSymmetricKey()
      const key2 = generateSymmetricKey()
      const plaintext = new TextEncoder().encode("secret")
      const { ciphertext, nonce } = encryptWithSymmetricKey(plaintext, key1)

      expect(() => decryptWithSymmetricKey(ciphertext, nonce, key2)).toThrow()
    })

    it("throws on tampered ciphertext", () => {
      const key = generateSymmetricKey()
      const plaintext = new TextEncoder().encode("tamper test")
      const { ciphertext, nonce } = encryptWithSymmetricKey(plaintext, key)

      // Flip a byte
      const tampered = new Uint8Array(ciphertext)
      tampered[0] ^= 0xff

      expect(() => decryptWithSymmetricKey(tampered, nonce, key)).toThrow()
    })

    it("throws on wrong nonce", () => {
      const key = generateSymmetricKey()
      const plaintext = new TextEncoder().encode("nonce test")
      const { ciphertext } = encryptWithSymmetricKey(plaintext, key)
      const wrongNonce = new Uint8Array(12)

      expect(() =>
        decryptWithSymmetricKey(ciphertext, wrongNonce, key),
      ).toThrow()
    })

    it("throws on invalid key length", () => {
      expect(() =>
        decryptWithSymmetricKey(
          new Uint8Array(32),
          new Uint8Array(12),
          new Uint8Array(16),
        ),
      ).toThrow("Key must be 32 bytes")
    })

    it("throws on invalid nonce length", () => {
      expect(() =>
        decryptWithSymmetricKey(
          new Uint8Array(32),
          new Uint8Array(8),
          new Uint8Array(32),
        ),
      ).toThrow("Nonce must be 12 bytes")
    })
  })
})

// ─── passphrase.ts ───────────────────────────────────────────────────────────

describe("passphrase (PBKDF2 + AES-256-GCM)", () => {
  describe("deriveKeyFromPassphrase", () => {
    it("returns a CryptoKey and 16-byte salt", async () => {
      const { key, salt } = await deriveKeyFromPassphrase("test-passphrase")
      expect(key).toBeDefined()
      expect(salt).toBeInstanceOf(Uint8Array)
      expect(salt.length).toBe(16)
    })

    it("generates different salts each call", async () => {
      const r1 = await deriveKeyFromPassphrase("same-pass")
      const r2 = await deriveKeyFromPassphrase("same-pass")
      expect(Array.from(r1.salt)).not.toEqual(Array.from(r2.salt))
    })

    it("derives same key with same salt", async () => {
      const { salt } = await deriveKeyFromPassphrase("deterministic")
      const r1 = await deriveKeyFromPassphrase("deterministic", salt)
      const r2 = await deriveKeyFromPassphrase("deterministic", salt)

      // Encrypt same data with both keys to verify they're equivalent
      const data = new Uint8Array([1, 2, 3, 4])
      const nonce = crypto.getRandomValues(new Uint8Array(12))

      const ct1 = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce },
        r1.key,
        data,
      )
      // Decrypt with the other key
      const pt = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce },
        r2.key,
        ct1,
      )
      expectBytesEqual(new Uint8Array(pt), data)
    })

    it("throws on empty passphrase", async () => {
      await expect(deriveKeyFromPassphrase("")).rejects.toThrow(
        "Passphrase must not be empty",
      )
    })
  })

  describe("encryptWithDerivedKey / decryptWithDerivedKey", () => {
    it("round-trips data correctly", async () => {
      const { key } = await deriveKeyFromPassphrase("my-secret")
      const original = new Uint8Array([10, 20, 30, 40, 50])

      const { ciphertext, nonce } = await encryptWithDerivedKey(original, key)
      const decrypted = await decryptWithDerivedKey(ciphertext, nonce, key)

      expectBytesEqual(decrypted, original)
    })

    it("returns 12-byte nonce", async () => {
      const { key } = await deriveKeyFromPassphrase("pass")
      const { nonce } = await encryptWithDerivedKey(new Uint8Array([1]), key)
      expect(nonce.length).toBe(12)
    })

    it("fails decryption with wrong key", async () => {
      const { key: key1 } = await deriveKeyFromPassphrase("pass1")
      const { key: key2 } = await deriveKeyFromPassphrase("pass2")
      const { ciphertext, nonce } = await encryptWithDerivedKey(
        new Uint8Array([1, 2, 3]),
        key1,
      )

      await expect(
        decryptWithDerivedKey(ciphertext, nonce, key2),
      ).rejects.toThrow()
    })
  })
})

// ─── double-encrypt.ts ───────────────────────────────────────────────────────

describe("doubleEncryptShare", () => {
  const fakePrivkey = new Uint8Array(32).fill(1)
  const fakePubkey = "a".repeat(64)

  // Simple NIP-44 stub for testing
  const testNip44: Nip44Ops = {
    encrypt(plaintext: string): string {
      return btoa(plaintext)
    },
    decrypt(ciphertext: string): string {
      return atob(ciphertext)
    },
  }

  it("returns all required fields without passphrase", async () => {
    const result = await doubleEncryptShare(
      "share-data-123",
      fakePubkey,
      fakePrivkey,
      undefined,
      testNip44,
    )

    expect(result.encryptedShare).toBeInstanceOf(Uint8Array)
    expect(result.nonce).toBeInstanceOf(Uint8Array)
    expect(result.nonce.length).toBe(12)
    expect(typeof result.encryptedKNostr).toBe("string")
    expect(result.encryptedKNostr.length).toBeGreaterThan(0)
    expect(result.encryptedKPassphrase).toBeUndefined()
    expect(result.plaintextK).toBeInstanceOf(Uint8Array)
    expect(result.plaintextK.length).toBe(32)
  })

  it("returns passphrase-encrypted K when passphrase provided", async () => {
    const result = await doubleEncryptShare(
      "share-data-456",
      fakePubkey,
      fakePrivkey,
      "my-secret-passphrase",
      testNip44,
    )

    expect(result.encryptedKPassphrase).toBeDefined()
    expect(result.encryptedKPassphrase!.ciphertext).toBeInstanceOf(Uint8Array)
    expect(result.encryptedKPassphrase!.nonce).toBeInstanceOf(Uint8Array)
    expect(result.encryptedKPassphrase!.nonce.length).toBe(12)
    expect(result.encryptedKPassphrase!.salt).toBeInstanceOf(Uint8Array)
    expect(result.encryptedKPassphrase!.salt.length).toBe(16)
  })

  it("encrypted share can be decrypted with plaintextK", async () => {
    const share = "my-secret-shamir-share-hex-data"
    const result = await doubleEncryptShare(
      share,
      fakePubkey,
      fakePrivkey,
      undefined,
      testNip44,
    )

    const decrypted = decryptWithSymmetricKey(
      result.encryptedShare,
      result.nonce,
      result.plaintextK,
    )
    expect(new TextDecoder().decode(decrypted)).toBe(share)
  })

  it("encryptedKNostr can be decrypted to recover K", async () => {
    const result = await doubleEncryptShare(
      "share",
      fakePubkey,
      fakePrivkey,
      undefined,
      testNip44,
    )

    // Decrypt the NIP-44 wrapped K
    const kHex = testNip44.decrypt(
      result.encryptedKNostr,
      fakePrivkey,
      fakePubkey,
    ) as string
    const recoveredK = hexToBytes(kHex)

    expectBytesEqual(recoveredK, result.plaintextK)
  })

  it("generates unique K for each call", async () => {
    const r1 = await doubleEncryptShare(
      "share",
      fakePubkey,
      fakePrivkey,
      undefined,
      testNip44,
    )
    const r2 = await doubleEncryptShare(
      "share",
      fakePubkey,
      fakePrivkey,
      undefined,
      testNip44,
    )

    expect(Array.from(r1.plaintextK)).not.toEqual(Array.from(r2.plaintextK))
  })

  it("works with async NIP-44 ops", async () => {
    const asyncNip44: Nip44Ops = {
      async encrypt(plaintext: string): Promise<string> {
        return btoa(plaintext)
      },
      async decrypt(ciphertext: string): Promise<string> {
        return atob(ciphertext)
      },
    }

    const result = await doubleEncryptShare(
      "async-share",
      fakePubkey,
      fakePrivkey,
      undefined,
      asyncNip44,
    )

    expect(result.encryptedShare).toBeInstanceOf(Uint8Array)
    expect(result.plaintextK.length).toBe(32)
  })
})

// ─── recovery.ts ─────────────────────────────────────────────────────────────

describe("recovery", () => {
  const fakePrivkey = new Uint8Array(32).fill(2)
  const fakePubkey = "b".repeat(64)

  const testNip44: Nip44Ops = {
    encrypt(plaintext: string): string {
      return btoa(plaintext)
    },
    decrypt(ciphertext: string): string {
      return atob(ciphertext)
    },
  }

  describe("recoverKFromNostr", () => {
    it("recovers K from NIP-44 encrypted payload", async () => {
      const K = generateSymmetricKey()
      const kHex = bytesToHex(K)
      const encrypted = testNip44.encrypt(kHex, fakePrivkey, fakePubkey) as string

      const recovered = await recoverKFromNostr(
        encrypted,
        fakePrivkey,
        fakePubkey,
        testNip44,
      )

      expectBytesEqual(recovered, K)
    })

    it("throws if recovered K is not 32 bytes", async () => {
      const badHex = "aabb" // only 2 bytes
      const encrypted = btoa(badHex)

      await expect(
        recoverKFromNostr(encrypted, fakePrivkey, fakePubkey, testNip44),
      ).rejects.toThrow("Recovered K must be 32 bytes")
    })
  })

  describe("recoverKFromPassphrase", () => {
    it("recovers K from passphrase-encrypted payload", async () => {
      const K = generateSymmetricKey()
      const passphrase = "correct-horse-battery-staple"

      // Encrypt K with passphrase
      const { key: derivedKey, salt } =
        await deriveKeyFromPassphrase(passphrase)
      const { ciphertext, nonce } = await encryptWithDerivedKey(K, derivedKey)

      const recovered = await recoverKFromPassphrase(
        { ciphertext, nonce, salt },
        passphrase,
      )

      expectBytesEqual(recovered, K)
    })

    it("fails with wrong passphrase", async () => {
      const K = generateSymmetricKey()
      const { key: derivedKey, salt } =
        await deriveKeyFromPassphrase("right-pass")
      const { ciphertext, nonce } = await encryptWithDerivedKey(K, derivedKey)

      await expect(
        recoverKFromPassphrase({ ciphertext, nonce, salt }, "wrong-pass"),
      ).rejects.toThrow()
    })
  })

  describe("recoverKFromOpReturn", () => {
    it("returns a copy of the 32-byte OP_RETURN data", () => {
      const K = generateSymmetricKey()
      const recovered = recoverKFromOpReturn(K)

      expectBytesEqual(recovered, K)
      // Verify it's a copy, not the same reference
      expect(recovered).not.toBe(K)
    })

    it("throws if data is not 32 bytes", () => {
      expect(() => recoverKFromOpReturn(new Uint8Array(16))).toThrow(
        "OP_RETURN data must be exactly 32 bytes",
      )
      expect(() => recoverKFromOpReturn(new Uint8Array(64))).toThrow(
        "OP_RETURN data must be exactly 32 bytes",
      )
      expect(() => recoverKFromOpReturn(new Uint8Array(0))).toThrow(
        "OP_RETURN data must be exactly 32 bytes",
      )
    })

    it("returned copy is independent of source", () => {
      const K = generateSymmetricKey()
      const recovered = recoverKFromOpReturn(K)

      // Mutate source
      K[0] ^= 0xff
      expect(recovered[0]).not.toBe(K[0])
    })
  })

  describe("decryptShare", () => {
    it("decrypts a share encrypted with ChaCha20-Poly1305", () => {
      const key = generateSymmetricKey()
      const share = "secret-shamir-share-data"
      const shareBytes = new TextEncoder().encode(share)
      const { ciphertext, nonce } = encryptWithSymmetricKey(shareBytes, key)

      const result = decryptShare(ciphertext, nonce, key)
      expect(result).toBe(share)
    })

    it("handles unicode shares", () => {
      const key = generateSymmetricKey()
      const share = "Share with unicode: \u{1F510}\u{1F511}\u{1F512}"
      const shareBytes = new TextEncoder().encode(share)
      const { ciphertext, nonce } = encryptWithSymmetricKey(shareBytes, key)

      expect(decryptShare(ciphertext, nonce, key)).toBe(share)
    })

    it("throws with wrong key", () => {
      const key1 = generateSymmetricKey()
      const key2 = generateSymmetricKey()
      const shareBytes = new TextEncoder().encode("share")
      const { ciphertext, nonce } = encryptWithSymmetricKey(shareBytes, key1)

      expect(() => decryptShare(ciphertext, nonce, key2)).toThrow()
    })
  })
})

// ─── Full end-to-end integration ─────────────────────────────────────────────

describe("end-to-end double encryption", () => {
  const senderPrivkey = new Uint8Array(32).fill(3)
  const recipientPrivkey = new Uint8Array(32).fill(4)
  const senderPubkey = "c".repeat(64)
  const recipientPubkey = "d".repeat(64)

  const testNip44: Nip44Ops = {
    encrypt(plaintext: string): string {
      return btoa(plaintext)
    },
    decrypt(ciphertext: string): string {
      return atob(ciphertext)
    },
  }

  it("encrypts and recovers share via Nostr path", async () => {
    const share = "shamir-share-for-recipient-1"

    const encrypted = await doubleEncryptShare(
      share,
      recipientPubkey,
      senderPrivkey,
      undefined,
      testNip44,
    )

    // Recipient recovers K via NIP-44
    const K = await recoverKFromNostr(
      encrypted.encryptedKNostr,
      recipientPrivkey,
      senderPubkey,
      testNip44,
    )

    // Decrypt share with recovered K
    const recovered = decryptShare(encrypted.encryptedShare, encrypted.nonce, K)
    expect(recovered).toBe(share)
  })

  it("encrypts and recovers share via passphrase path", async () => {
    const share = "shamir-share-for-recipient-2"
    const passphrase = "quantum-safe-passphrase-2024"

    const encrypted = await doubleEncryptShare(
      share,
      recipientPubkey,
      senderPrivkey,
      passphrase,
      testNip44,
    )

    // Recipient recovers K via passphrase
    const K = await recoverKFromPassphrase(
      encrypted.encryptedKPassphrase!,
      passphrase,
    )

    const recovered = decryptShare(encrypted.encryptedShare, encrypted.nonce, K)
    expect(recovered).toBe(share)
  })

  it("encrypts and recovers share via OP_RETURN path", async () => {
    const share = "shamir-share-for-recipient-3"

    const encrypted = await doubleEncryptShare(
      share,
      recipientPubkey,
      senderPrivkey,
      undefined,
      testNip44,
    )

    // Recipient recovers K from Bitcoin OP_RETURN
    const K = recoverKFromOpReturn(encrypted.plaintextK)

    const recovered = decryptShare(encrypted.encryptedShare, encrypted.nonce, K)
    expect(recovered).toBe(share)
  })

  it("all three recovery paths yield the same K", async () => {
    const share = "multi-path-share"
    const passphrase = "backup-passphrase"

    const encrypted = await doubleEncryptShare(
      share,
      recipientPubkey,
      senderPrivkey,
      passphrase,
      testNip44,
    )

    const kNostr = await recoverKFromNostr(
      encrypted.encryptedKNostr,
      recipientPrivkey,
      senderPubkey,
      testNip44,
    )
    const kPassphrase = await recoverKFromPassphrase(
      encrypted.encryptedKPassphrase!,
      passphrase,
    )
    const kOpReturn = recoverKFromOpReturn(encrypted.plaintextK)

    expectBytesEqual(kNostr, kPassphrase)
    expectBytesEqual(kPassphrase, kOpReturn)

    // And all decrypt the share correctly
    expect(decryptShare(encrypted.encryptedShare, encrypted.nonce, kNostr)).toBe(
      share,
    )
    expect(
      decryptShare(encrypted.encryptedShare, encrypted.nonce, kPassphrase),
    ).toBe(share)
    expect(
      decryptShare(encrypted.encryptedShare, encrypted.nonce, kOpReturn),
    ).toBe(share)
  })

  it("handles large shares", async () => {
    const share = "X".repeat(10_000)

    const encrypted = await doubleEncryptShare(
      share,
      recipientPubkey,
      senderPrivkey,
      undefined,
      testNip44,
    )

    const K = recoverKFromOpReturn(encrypted.plaintextK)
    expect(decryptShare(encrypted.encryptedShare, encrypted.nonce, K)).toBe(
      share,
    )
  })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
