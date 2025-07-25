import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSupabaseClient } from "./setup";

// Import setup to apply mocks
import "./setup";

import { DELETE } from "@/app/api/secrets/[id]/route";

describe("/api/secrets/[id] DELETE", () => {
    const mockUser = {
        id: "user-123",
        email: "test@example.com",
    };

    const mockSecret = {
        id: "secret-123",
        user_id: "user-123",
        title: "Test Secret",
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset Supabase mocks
        mockSupabaseClient.auth.getUser.mockResolvedValue({
            data: { user: mockUser },
            error: null,
        });
    });

    it("should delete a secret successfully", async () => {
        // Create chainable mocks
        const selectChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
                data: mockSecret,
                error: null,
            }),
        };

        const deleteChain = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                error: null,
            }),
            single: vi.fn(),
        };

        // Setup from() to return appropriate chains
        mockSupabaseClient.from
            .mockReturnValueOnce({
                ...selectChain,
                delete: vi.fn(),
                insert: vi.fn().mockReturnThis(),
                update: vi.fn().mockReturnThis(),
            })
            .mockReturnValueOnce({
                ...deleteChain,
                select: vi.fn(),
                insert: vi.fn().mockReturnThis(),
                update: vi.fn().mockReturnThis(),
            });

        const mockRequest = new Request(
            "http://localhost/api/secrets/secret-123",
            {
                method: "DELETE",
            },
        );

        const response = await DELETE(mockRequest, {
            params: Promise.resolve({ id: "secret-123" }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // Verify both from() calls were made
        expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2);
        expect(mockSupabaseClient.from).toHaveBeenCalledWith("secrets");
    });

    it("should return 401 when user is not authenticated", async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const mockRequest = new Request(
            "http://localhost/api/secrets/secret-123",
            {
                method: "DELETE",
            },
        );

        const response = await DELETE(mockRequest, {
            params: Promise.resolve({ id: "secret-123" }),
        });
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
    });

    it("should return 404 when secret is not found", async () => {
        const mockSelect = vi.fn().mockReturnThis();
        const mockEq = vi.fn().mockReturnThis();
        const mockSingle = vi.fn().mockResolvedValue({
            data: null,
            error: new Error("Secret not found"),
        });

        mockSupabaseClient.from.mockReturnValue({
            select: mockSelect,
            eq: mockEq,
            single: mockSingle,
            delete: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
        });

        const mockRequest = new Request(
            "http://localhost/api/secrets/secret-123",
            {
                method: "DELETE",
            },
        );

        const response = await DELETE(mockRequest, {
            params: Promise.resolve({ id: "secret-123" }),
        });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe("Secret not found");
    });

    it("should return 404 when user doesn't own the secret", async () => {
        const mockSelect = vi.fn().mockReturnThis();
        const mockEq = vi.fn().mockReturnThis();
        const mockSingle = vi.fn().mockResolvedValue({
            data: null, // No secret returned due to user_id mismatch
            error: null,
        });

        mockSupabaseClient.from.mockReturnValue({
            select: mockSelect,
            eq: mockEq,
            single: mockSingle,
            delete: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
        });

        const mockRequest = new Request(
            "http://localhost/api/secrets/secret-123",
            {
                method: "DELETE",
            },
        );

        const response = await DELETE(mockRequest, {
            params: Promise.resolve({ id: "secret-123" }),
        });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe("Secret not found");
    });

    it("should return 500 when delete operation fails", async () => {
        const mockSelect = vi.fn().mockReturnThis();
        const mockEq = vi.fn().mockReturnThis();
        const mockSingle = vi.fn().mockResolvedValue({
            data: mockSecret,
            error: null,
        });
        const mockDelete = vi.fn().mockReturnThis();
        const mockDeleteEq = vi.fn().mockResolvedValue({
            error: new Error("Delete failed"),
        });

        // First call to from() returns select chain for verification
        // Second call to from() returns delete chain for deletion
        mockSupabaseClient.from
            .mockReturnValueOnce({
                select: mockSelect,
                eq: mockEq,
                single: mockSingle,
                delete: vi.fn(),
                insert: vi.fn().mockReturnThis(),
                update: vi.fn().mockReturnThis(),
            })
            .mockReturnValueOnce({
                select: vi.fn(),
                eq: vi.fn(),
                single: vi.fn(),
                delete: mockDelete,
                insert: vi.fn().mockReturnThis(),
                update: vi.fn().mockReturnThis(),
            });

        mockDelete.mockReturnValue({
            eq: mockDeleteEq,
        });

        const mockRequest = new Request(
            "http://localhost/api/secrets/secret-123",
            {
                method: "DELETE",
            },
        );

        const response = await DELETE(mockRequest, {
            params: Promise.resolve({ id: "secret-123" }),
        });
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Failed to delete secret");
    });

    it("should handle unexpected errors gracefully", async () => {
        mockSupabaseClient.auth.getUser.mockRejectedValue(
            new Error("Unexpected error"),
        );

        const mockRequest = new Request(
            "http://localhost/api/secrets/secret-123",
            {
                method: "DELETE",
            },
        );

        const response = await DELETE(mockRequest, {
            params: Promise.resolve({ id: "secret-123" }),
        });
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Internal server error");
    });
});
