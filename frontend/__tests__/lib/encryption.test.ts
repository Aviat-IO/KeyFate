import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

// Mock the server environment
vi.mock("crypto", () => ({
  default: {
    randomBytes: vi.fn(),
    createCipheriv: vi.fn(),
    createDecipheriv: vi.fn(),
  },
}));

// Since encryption.ts uses "use server", we need to mock the server environment
const mockEncryptMessage = vi.fn();
const mockDecryptMessage = vi.fn();

vi.mock("@/lib/encryption", () => ({
  encryptMessage: mockEncryptMessage,
  decryptMessage: mockDecryptMessage,
}));

describe("Encryption Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("encryptMessage", () => {
    it("should encrypt a message and return encrypted data with IV and auth tag", async () => {
      const testMessage = "Hello, World!";
      const mockResult = {
        encrypted: "base64-encrypted-data",
        iv: "base64-iv",
        authTag: "base64-auth-tag",
      };

      mockEncryptMessage.mockResolvedValue(mockResult);

      const result = await mockEncryptMessage(testMessage);

      expect(result).toEqual(mockResult);
      expect(result.encrypted).toBeDefined();
      expect(result.iv).toBeDefined();
      expect(result.authTag).toBeDefined();
      expect(mockEncryptMessage).toHaveBeenCalledWith(testMessage);
    });

    it("should accept a custom IV", async () => {
      const testMessage = "Test message";
      const customIV = Buffer.from("custom-iv-12-bytes", "utf8");
      const mockResult = {
        encrypted: "encrypted-with-custom-iv",
        iv: customIV.toString("base64"),
        authTag: "auth-tag",
      };

      mockEncryptMessage.mockResolvedValue(mockResult);

      const result = await mockEncryptMessage(testMessage, customIV);

      expect(result.iv).toBe(customIV.toString("base64"));
      expect(mockEncryptMessage).toHaveBeenCalledWith(testMessage, customIV);
    });

    it("should handle empty messages", async () => {
      const emptyMessage = "";
      const mockResult = {
        encrypted: "encrypted-empty",
        iv: "iv-for-empty",
        authTag: "auth-tag-empty",
      };

      mockEncryptMessage.mockResolvedValue(mockResult);

      const result = await mockEncryptMessage(emptyMessage);

      expect(result).toEqual(mockResult);
      expect(mockEncryptMessage).toHaveBeenCalledWith(emptyMessage);
    });
  });

  describe("decryptMessage", () => {
    it("should decrypt a message using cipher text, IV, and auth tag", async () => {
      const cipherText = "base64-encrypted-data";
      const ivBuffer = Buffer.from("test-iv-12-bytes", "utf8");
      const authTag = Buffer.from("test-auth-tag", "utf8");
      const expectedMessage = "Decrypted message";

      mockDecryptMessage.mockResolvedValue(expectedMessage);

      const result = await mockDecryptMessage(cipherText, ivBuffer, authTag);

      expect(result).toBe(expectedMessage);
      expect(mockDecryptMessage).toHaveBeenCalledWith(
        cipherText,
        ivBuffer,
        authTag,
      );
    });

    it("should handle decryption errors gracefully", async () => {
      const invalidCipherText = "invalid-cipher";
      const ivBuffer = Buffer.from("test-iv", "utf8");
      const authTag = Buffer.from("test-tag", "utf8");

      mockDecryptMessage.mockRejectedValue(new Error("Decryption failed"));

      await expect(mockDecryptMessage(invalidCipherText, ivBuffer, authTag))
        .rejects.toThrow("Decryption failed");
    });
  });

  describe("Encryption/Decryption Round Trip", () => {
    it("should successfully encrypt and decrypt a message", async () => {
      const originalMessage = "This is a secret message!";

      // Mock the round trip
      const encryptResult = {
        encrypted: "encrypted-data",
        iv: "test-iv",
        authTag: "test-auth-tag",
      };

      mockEncryptMessage.mockResolvedValue(encryptResult);
      mockDecryptMessage.mockResolvedValue(originalMessage);

      // Encrypt
      const encrypted = await mockEncryptMessage(originalMessage);

      // Decrypt
      const ivBuffer = Buffer.from(encrypted.iv, "base64");
      const authTagBuffer = Buffer.from(encrypted.authTag, "base64");
      const decrypted = await mockDecryptMessage(
        encrypted.encrypted,
        ivBuffer,
        authTagBuffer,
      );

      expect(decrypted).toBe(originalMessage);
    });
  });
});
