import { describe, it, expect } from "vitest";
import {
  validateTestEnvironment,
  getTestDatabaseConnection,
  seedTestData,
  cleanupTestData,
} from "./utils/test-db";

describe("Test Environment Configuration", () => {
  describe("Environment Variables", () => {
    it("should have DATABASE_URL configured", () => {
      const result = validateTestEnvironment();
      expect(result.isValid).toBe(true);
      expect(result.variables.DATABASE_URL).toBeDefined();
      expect(result.variables.DATABASE_URL).toContain("test_db");
    });

    it("should have all required environment variables", () => {
      const result = validateTestEnvironment();
      expect(result.isValid).toBe(true);
      expect(result.variables.NEXTAUTH_SECRET).toBeDefined();
      expect(result.variables.ENCRYPTION_KEY).toBeDefined();
      expect(result.variables.GOOGLE_CLIENT_ID).toBeDefined();
    });

    it("should not use production database URL", () => {
      const result = validateTestEnvironment();
      expect(result.variables.DATABASE_URL).not.toContain("cloud.google.com");
      expect(result.variables.DATABASE_URL).not.toContain("production");
      expect(result.variables.DATABASE_URL).toContain("test_db");
    });

    it("should identify missing required variables", () => {
      const result = validateTestEnvironment();
      if (!result.isValid) {
        expect(result.missingVariables).toBeDefined();
        expect(Array.isArray(result.missingVariables)).toBe(true);
      }
    });
  });

  describe("Database Connectivity", () => {
    it("should connect to test database", async () => {
      const connection = await getTestDatabaseConnection();
      expect(connection).toBeDefined();
      expect(connection.isConnected).toBe(true);
    });

    it("should verify database is test database", async () => {
      const connection = await getTestDatabaseConnection();
      expect(connection.databaseName).toBe("test_db");
    });

    it("should support database queries", async () => {
      const connection = await getTestDatabaseConnection();
      const result = await connection.query("SELECT 1 as value");
      expect(result.rows).toBeDefined();
      expect(Array.isArray(result.rows)).toBe(true);
    });

    it("should get list of tables", async () => {
      const connection = await getTestDatabaseConnection();
      const tables = await connection.getTables();
      expect(Array.isArray(tables)).toBe(true);
      // In mock mode, should return mock tables
      expect(tables.length).toBeGreaterThan(0);
    });
  });

  describe("Test Data Utilities", () => {
    it("should seed test users", async () => {
      const data = await seedTestData({
        users: [
          {
            id: "test-user-1",
            email: "test1@example.com",
            name: "Test User 1",
          },
        ],
      });

      expect(data.users).toHaveLength(1);
      expect(data.users[0].id).toBe("test-user-1");
      expect(data.users[0].email).toBe("test1@example.com");
    });

    it("should seed test secrets", async () => {
      const data = await seedTestData({
        users: [
          {
            id: "test-user-2",
            email: "test2@example.com",
            name: "Test User 2",
          },
        ],
        secrets: [
          {
            userId: "test-user-2",
            title: "Test Secret",
            recipientName: "Recipient",
            recipientEmail: "recipient@example.com",
            contactMethod: "email",
            checkInDays: 30,
          },
        ],
      });

      expect(data.secrets).toHaveLength(1);
      expect(data.secrets[0].title).toBe("Test Secret");
      expect(data.secrets[0].userId).toBe("test-user-2");
    });

    it("should cleanup test data without errors", async () => {
      // This should not throw
      await expect(cleanupTestData()).resolves.not.toThrow();
    });
  });

  describe("Production Data Isolation", () => {
    it("should not affect production data", () => {
      const result = validateTestEnvironment();
      expect(result.variables.DATABASE_URL).not.toContain("production");
      expect(result.variables.DATABASE_URL).not.toContain("cloud.google.com");
    });

    it("should use local database", () => {
      const result = validateTestEnvironment();
      expect(result.variables.DATABASE_URL).toContain("localhost");
    });
  });
});
