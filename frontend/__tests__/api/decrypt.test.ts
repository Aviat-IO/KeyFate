import { beforeEach, describe, expect, it, vi } from "vitest";

// Import setup to apply mocks
import "./setup";

// Set environment variable before importing the route
process.env.ENCRYPTION_KEY = "a".repeat(32);

import { POST } from "@/app/api/decrypt/route";

describe("/api/decrypt", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variable
    process.env.ENCRYPTION_KEY = "a".repeat(32); // 32 character key

    // Reset crypto mocks
    const mockDecrypt = vi.fn(() => Promise.resolve(new ArrayBuffer(16)));
    const mockImportKey = vi.fn(() => Promise.resolve({}));

    Object.defineProperty(global, "crypto", {
      value: {
        subtle: {
          importKey: mockImportKey,
          decrypt: mockDecrypt,
        },
      },
    });
  });

  it("should decrypt a message successfully", async () => {
    // Mock successful decryption
    const mockDecryptedBuffer = new TextEncoder().encode("decrypted message");
    Object.defineProperty(global, "crypto", {
      value: {
        subtle: {
          importKey: vi.fn(() => Promise.resolve({})),
          decrypt: vi.fn(() => Promise.resolve(mockDecryptedBuffer.buffer)),
        },
      },
    });

    const mockRequest = new Request("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encryptedMessage: "dGVzdA==", // base64 encoded
        iv: "aXYxMjM=", // base64 encoded
      }),
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(data).toHaveProperty("decryptedMessage");
    expect(data.decryptedMessage).toBe("decrypted message");
  });

  it("should return 400 when encryptedMessage is missing", async () => {
    const mockRequest = new Request("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ iv: "aXYxMjM=" }),
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing encryptedMessage or iv");
  });

  it("should return 400 when iv is missing", async () => {
    const mockRequest = new Request("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encryptedMessage: "dGVzdA==" }),
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing encryptedMessage or iv");
  });

  it("should return 400 when both parameters are missing", async () => {
    const mockRequest = new Request("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing encryptedMessage or iv");
  });

  it("should return 500 when decryption fails", async () => {
    // Mock crypto.subtle.decrypt to throw an error
    Object.defineProperty(global, "crypto", {
      value: {
        subtle: {
          importKey: vi.fn(() => Promise.resolve({})),
          decrypt: vi.fn(() => Promise.reject(new Error("Decryption failed"))),
        },
      },
    });

    const mockRequest = new Request("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encryptedMessage: "dGVzdA==",
        iv: "aXYxMjM=",
      }),
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Decryption failed");
  });

  it("should handle invalid JSON request", async () => {
    const mockRequest = new Request("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Decryption failed");
  });

  it("should use correct decryption parameters", async () => {
    const mockImportKey = vi.fn(() => Promise.resolve({}));
    const mockDecrypt = vi.fn(() => Promise.resolve(new ArrayBuffer(16)));

    Object.defineProperty(global, "crypto", {
      value: {
        subtle: {
          importKey: mockImportKey,
          decrypt: mockDecrypt,
        },
      },
    });

    const mockRequest = new Request("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encryptedMessage: "dGVzdA==",
        iv: "aXYxMjM=",
      }),
    });

    await POST(mockRequest);

    // Verify importKey was called with correct parameters
    expect(mockImportKey).toHaveBeenCalledWith(
      "raw",
      expect.any(Uint8Array),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    // Verify decrypt was called with correct parameters
    expect(mockDecrypt).toHaveBeenCalledWith(
      {
        name: "AES-GCM",
        iv: expect.any(Uint8Array),
      },
      {},
      expect.any(Uint8Array),
    );
  });

  it("should handle invalid base64 input gracefully", async () => {
    // Mock atob to throw an error for invalid base64
    const originalAtob = global.atob;
    global.atob = vi.fn((str) => {
      if (str.includes("!@#")) {
        throw new Error("Invalid base64");
      }
      return originalAtob(str);
    });

    const mockRequest = new Request("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encryptedMessage: "invalid-base64!@#",
        iv: "invalid-base64!@#",
      }),
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Decryption failed");

    // Restore original atob
    global.atob = originalAtob;
  });
});
