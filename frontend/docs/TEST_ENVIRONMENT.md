# Test Environment Configuration

## Overview

This document explains the test environment configuration for the Dead Man's Switch application, including database setup, test data management, and environment variable configuration.

## Environment Variables

### Required Variables

The following environment variables must be configured in `vitest.config.mts`:

```typescript
env: {
  DATABASE_URL: "postgresql://postgres:test_password@localhost:5432/test_db",
  NEXTAUTH_SECRET: "test-nextauth-secret-32-chars-l",
  NEXTAUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  ENCRYPTION_KEY: "test_encryption_key_32_bytes_long_for_testing",
  EMAIL_PROVIDER: "mock",
}
```

### Database URL Configuration

**Important**: The test `DATABASE_URL` must:
- Point to a **test database** (not production)
- Use localhost PostgreSQL (not Cloud SQL)
- Include "test_db" or "test-db" in the database name
- Never contain "production" or "cloud.google.com"

## Test Database Modes

The test environment supports two modes:

###  1. Mock Mode (Default - No PostgreSQL Required)

When PostgreSQL is not available, the test utilities automatically fall back to mock mode:

```typescript
// Automatically uses mocks when PostgreSQL unavailable
const connection = await getTestDatabaseConnection();
const data = await seedTestData({ users: [...] });
```

**Characteristics:**
- No database connection required
- Returns mock data for all operations
- Suitable for unit tests and CI/CD pipelines
- Warning messages displayed in test output

### 2. Integration Mode (PostgreSQL Required)

When PostgreSQL is running on localhost:5432, tests use real database:

```bash
# Start PostgreSQL
brew services start postgresql@14
# or
docker run -p 5432:5432 -e POSTGRES_PASSWORD=test_password postgres:14
```

**Characteristics:**
- Real database operations
- Schema migrations applied
- Full integration testing
- Requires PostgreSQL running locally

## Test Utilities

### Environment Validation

```typescript
import { validateTestEnvironment } from "./__tests__/utils/test-db";

const result = validateTestEnvironment();
if (!result.isValid) {
  console.error("Missing variables:", result.missingVariables);
}
```

### Database Connection

```typescript
import { getTestDatabaseConnection } from "./__tests__/utils/test-db";

const connection = await getTestDatabaseConnection();
console.log("Database:", connection.databaseName);
console.log("Connected:", connection.isConnected);
```

### Test Database Setup

```typescript
import {
  createTestDatabase,
  cleanupTestDatabase,
} from "./__tests__/utils/test-db";

// Setup before tests
await createTestDatabase(); // Runs migrations

// Cleanup after tests
await cleanupTestDatabase(); // Drops all tables
```

### Test Data Seeding

```typescript
import { seedTestData, cleanupTestData } from "./__tests__/utils/test-db";

// Seed test users and secrets
const data = await seedTestData({
  users: [
    {
      id: "test-user-1",
      email: "test@example.com",
      name: "Test User",
    },
  ],
  secrets: [
    {
      userId: "test-user-1",
      title: "Test Secret",
      recipientName: "Recipient",
      recipientEmail: "recipient@example.com",
      contactMethod: "email",
      checkInDays: 30,
    },
  ],
});

// Cleanup test data (preserves schema)
await cleanupTestData();
```

## Test Isolation

### Between Tests

Each test should:
1. Seed required data at the beginning
2. Clean up data at the end
3. Never assume data from previous tests exists

```typescript
describe("My Feature", () => {
  beforeEach(async () => {
    await seedTestData({ users: [...] });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should do something", async () => {
    // Test uses seeded data
  });
});
```

### Between Test Suites

Each test suite should:
1. Create database schema in `beforeAll`
2. Drop database schema in `afterAll`
3. Use separate database for integration tests

```typescript
describe("Integration Tests", () => {
  beforeAll(async () => {
    await createTestDatabase();
  }, 10000);

  afterAll(async () => {
    await cleanupTestDatabase();
  }, 10000);

  // Tests...
});
```

## Production Data Isolation

The test environment includes multiple safeguards to prevent production data access:

### 1. Environment Variable Validation

```typescript
// Automatically validates DATABASE_URL
const result = validateTestEnvironment();
// Fails if URL contains "production" or "cloud.google.com"
```

### 2. Database Name Validation

```typescript
// Requires "test_db" or "test-db" in database name
if (!databaseUrl.includes("test")) {
  throw new Error("Test database name required");
}
```

### 3. Connection Isolation

```typescript
// Test connection pool separate from application
const testConnection = postgres(databaseUrl, {
  max: 1, // Single connection for tests
  idle_timeout: 20,
  connect_timeout: 2,
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      # No PostgreSQL needed - uses mock mode
```

### With PostgreSQL

```yaml
name: Integration Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
```

## Troubleshooting

### PostgreSQL Connection Errors

If you see `ECONNREFUSED ::1:5432`:
- Tests automatically fall back to mock mode
- No action required for unit tests
- For integration tests, start PostgreSQL:
  ```bash
  brew services start postgresql@14
  # or
  docker run -p 5432:5432 -e POSTGRES_PASSWORD=test_password postgres:14
  ```

### Database Already Exists

If migrations fail with "relation already exists":
- Tests handle this automatically
- To manually reset: `await cleanupTestDatabase()`

### Test Timeouts

If tests timeout during cleanup:
- Increase timeout in `beforeAll`/`afterAll` hooks
- Check for hanging database connections
- Ensure `cleanupTestDatabase()` is called in `afterAll`

## Best Practices

### 1. Use Transactions for Test Isolation

```typescript
describe("Transaction Tests", () => {
  let transaction;

  beforeEach(async () => {
    transaction = await db.transaction();
  });

  afterEach(async () => {
    await transaction.rollback();
  });
});
```

### 2. Mock External Services

```typescript
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
}));
```

### 3. Use Test Fixtures

```typescript
// __tests__/fixtures/users.ts
export const testUsers = {
  admin: {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin User",
  },
  regular: {
    id: "user-1",
    email: "user@example.com",
    name: "Regular User",
  },
};
```

### 4. Clean Up Resources

```typescript
afterEach(async () => {
  await cleanupTestData();
  vi.clearAllMocks();
});
```

## File Structure

```
frontend/
├── __tests__/
│   ├── utils/
│   │   └── test-db.ts          # Test database utilities
│   ├── setup.ts                 # Global test setup
│   └── test-environment.test.ts # Environment validation tests
├── vitest.config.mts            # Vitest configuration
└── docs/
    └── TEST_ENVIRONMENT.md      # This file
```

## Summary

- **Mock Mode**: Default, no PostgreSQL required
- **Integration Mode**: Requires local PostgreSQL
- **Environment Variables**: Validated automatically
- **Test Isolation**: Automatic cleanup between tests
- **Production Safety**: Multiple validation layers
- **CI/CD Ready**: Works without external dependencies
