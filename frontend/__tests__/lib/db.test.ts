import { beforeEach, describe, expect, it, vi } from "vitest";

// Create a chainable mock that returns itself for all methods
const createChainableMock = () => {
  const mock = vi.fn();
  const chainable: any = {};

  chainable.select = vi.fn().mockReturnValue(chainable);
  chainable.insert = vi.fn().mockReturnValue(chainable);
  chainable.update = vi.fn().mockReturnValue(chainable);
  chainable.delete = vi.fn().mockReturnValue(chainable);
  chainable.eq = vi.fn().mockReturnValue(chainable);
  chainable.lt = vi.fn().mockReturnValue(chainable);
  chainable.order = vi.fn().mockReturnValue(chainable);
  chainable.single = vi.fn().mockReturnValue({ data: null, error: null });

  // Make the mock return the chainable object
  mock.mockReturnValue(chainable);

  return { mock, chainable };
};

const { mock: mockFrom, chainable: mockChain } = createChainableMock();

const mockSupabase = {
  from: mockFrom,
};

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

// Import after mocking
const {
  getAllSecrets,
  getSecret,
  createSecret,
  updateSecret,
  deleteSecret,
  getOverdueSecrets,
} = await import("@/lib/db");

const mockSecret = {
  id: "123",
  title: "Test Secret",
  user_id: "user-123",
  status: "active",
  next_check_in: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockSecretInsert = {
  title: "New Secret",
  user_id: "user-123",
  encrypted_message: "encrypted-data",
  recipient_name: "John Doe",
  recipient_email: "john@example.com",
  check_in_interval_days: 7,
  next_check_in: new Date().toISOString(),
  status: "active" as const,
};

describe("Database Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the chainable mock to ensure proper chaining
    mockChain.select.mockReturnValue(mockChain);
    mockChain.insert.mockReturnValue(mockChain);
    mockChain.update.mockReturnValue(mockChain);
    mockChain.delete.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.lt.mockReturnValue(mockChain);
    mockChain.order.mockReturnValue(mockChain);
    mockChain.single.mockReturnValue({ data: null, error: null });
  });

  describe("getAllSecrets", () => {
    it("should fetch all secrets for a user", async () => {
      mockChain.order.mockResolvedValue({ data: [mockSecret], error: null });

      const result = await getAllSecrets("user-123");

      expect(mockSupabase.from).toHaveBeenCalledWith("secrets");
      expect(mockChain.select).toHaveBeenCalledWith("*");
      expect(mockChain.eq).toHaveBeenCalledWith("user_id", "user-123");
      expect(mockChain.order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(result).toEqual([mockSecret]);
    });

    it("should throw error when database query fails", async () => {
      mockChain.order.mockResolvedValue({
        data: null,
        error: new Error("Database error"),
      });

      await expect(getAllSecrets("user-123")).rejects.toThrow("Database error");
    });
  });

  describe("getSecret", () => {
    it("should fetch a specific secret", async () => {
      mockChain.single.mockResolvedValue({ data: mockSecret, error: null });

      const result = await getSecret("123", "user-123");

      expect(mockSupabase.from).toHaveBeenCalledWith("secrets");
      expect(mockChain.select).toHaveBeenCalledWith("*");
      expect(mockChain.eq).toHaveBeenCalledWith("id", "123");
      expect(mockChain.eq).toHaveBeenCalledWith("user_id", "user-123");
      expect(mockChain.single).toHaveBeenCalled();
      expect(result).toEqual(mockSecret);
    });

    it("should throw error when secret not found", async () => {
      mockChain.single.mockResolvedValue({
        data: null,
        error: new Error("Not found"),
      });

      await expect(getSecret("123", "user-123")).rejects.toThrow("Not found");
    });
  });

  describe("createSecret", () => {
    it("should create a new secret", async () => {
      mockChain.single.mockResolvedValue({ data: mockSecret, error: null });

      const result = await createSecret(mockSecretInsert);

      expect(mockSupabase.from).toHaveBeenCalledWith("secrets");
      expect(mockChain.insert).toHaveBeenCalledWith([mockSecretInsert]);
      expect(result).toEqual(mockSecret);
    });

    it("should throw error when creation fails", async () => {
      mockChain.single.mockResolvedValue({
        data: null,
        error: new Error("Creation failed"),
      });

      await expect(createSecret(mockSecretInsert)).rejects.toThrow(
        "Creation failed",
      );
    });
  });

  describe("updateSecret", () => {
    it("should update a secret", async () => {
      const updateData = { title: "Updated Secret" };
      const updatedSecret = { ...mockSecret, ...updateData };

      mockChain.single.mockResolvedValue({ data: updatedSecret, error: null });

      const result = await updateSecret("123", updateData);

      expect(mockSupabase.from).toHaveBeenCalledWith("secrets");
      expect(mockChain.update).toHaveBeenCalledWith(updateData);
      expect(mockChain.eq).toHaveBeenCalledWith("id", "123");
      expect(result).toEqual(updatedSecret);
    });

    it("should throw error when update fails", async () => {
      mockChain.single.mockResolvedValue({
        data: null,
        error: new Error("Update failed"),
      });

      await expect(updateSecret("123", { title: "Updated" })).rejects.toThrow(
        "Update failed",
      );
    });
  });

  describe("deleteSecret", () => {
    it("should delete a secret", async () => {
      mockChain.eq.mockResolvedValue({ error: null });

      await deleteSecret("123");

      expect(mockSupabase.from).toHaveBeenCalledWith("secrets");
      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.eq).toHaveBeenCalledWith("id", "123");
    });

    it("should throw error when deletion fails", async () => {
      mockChain.eq.mockResolvedValue({ error: new Error("Deletion failed") });

      await expect(deleteSecret("123")).rejects.toThrow("Deletion failed");
    });
  });

  describe("getOverdueSecrets", () => {
    it("should fetch overdue secrets", async () => {
      const overdueSecret = {
        ...mockSecret,
        next_check_in: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      };

      mockChain.lt.mockResolvedValue({ data: [overdueSecret], error: null });

      const result = await getOverdueSecrets();

      expect(mockSupabase.from).toHaveBeenCalledWith("secrets");
      expect(mockChain.select).toHaveBeenCalledWith("*");
      expect(mockChain.eq).toHaveBeenCalledWith("status", "active");
      expect(mockChain.lt).toHaveBeenCalledWith(
        "next_check_in",
        expect.any(String),
      );
      expect(result).toEqual([overdueSecret]);
    });

    it("should throw error when query fails", async () => {
      mockChain.lt.mockResolvedValue({
        data: null,
        error: new Error("Query failed"),
      });

      await expect(getOverdueSecrets()).rejects.toThrow("Query failed");
    });
  });
});
