import { beforeEach, describe, expect, it, vi } from "vitest";

// Import setup to apply mocks
import "./setup";

// Set environment variable before importing the route
process.env.ENCRYPTION_KEY = "a".repeat(32);

import { POST } from "@/app/api/encrypt/route";

describe("/api/encrypt", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variable
    process.env.ENCRYPTION_KEY = "a".repeat(32); // 32 character key

    // Reset crypto mocks
    const mockEncrypt = vi.fn(() => Promise.resolve(new ArrayBuffer(16)));
    const mockImportKey = vi.fn(() => Promise.resolve({}));

    Object.defineProperty(global, "crypto", {
      value: {
        getRandomValues: vi.fn((arr) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
          }
          return arr;
        }),
        subtle: {
          importKey: mockImportKey,
          encrypt: mockEncrypt,
        },
      },
    });
  });

  it("should encrypt a message successfully", async () => {
    const mockRequest = new Request("http://localhost/api/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "test message" }),
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(data).toHaveProperty("encryptedMessage");
    expect(data).toHaveProperty("iv");
    expect(typeof data.encryptedMessage).toBe("string");
    expect(typeof data.iv).toBe("string");
  });

  it("should return 400 when message is missing", async () => {
    const mockRequest = new Request("http://localhost/api/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing message to encrypt");
  });

  it("should return 400 when message is empty", async () => {
    const mockRequest = new Request("http://localhost/api/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing message to encrypt");
  });

  it("should return 500 when encryption fails", async () => {
    // Mock crypto.subtle.encrypt to throw an error
    Object.defineProperty(global, "crypto", {
      value: {
        getRandomValues: vi.fn((arr) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
          }
          return arr;
        }),
        subtle: {
          importKey: vi.fn(() => Promise.resolve({})),
          encrypt: vi.fn(() => Promise.reject(new Error("Encryption failed"))),
        },
      },
    });

    const mockRequest = new Request("http://localhost/api/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "test message" }),
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Encryption failed");
  });

  it("should handle invalid JSON request", async () => {
    const mockRequest = new Request("http://localhost/api/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Encryption failed");
  });

  it("should use correct encryption parameters", async () => {
    const mockImportKey = vi.fn(() => Promise.resolve({}));
    const mockEncrypt = vi.fn(() => Promise.resolve(new ArrayBuffer(16)));

    Object.defineProperty(global, "crypto", {
      value: {
        getRandomValues: vi.fn((arr) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = i % 256;
          }
          return arr;
        }),
        subtle: {
          importKey: mockImportKey,
          encrypt: mockEncrypt,
        },
      },
    });

    const mockRequest = new Request("http://localhost/api/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "test message" }),
    });

    await POST(mockRequest);

    // Verify importKey was called with correct parameters
    expect(mockImportKey).toHaveBeenCalledWith(
      "raw",
      expect.any(Uint8Array),
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );

    // Verify encrypt was called with correct parameters
    expect(mockEncrypt).toHaveBeenCalledWith(
      {
        name: "AES-GCM",
        iv: expect.any(Uint8Array),
      },
      {},
      expect.any(Uint8Array),
    );
  });
});
