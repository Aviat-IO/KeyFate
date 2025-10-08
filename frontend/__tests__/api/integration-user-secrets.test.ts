/**
 * Integration Tests for User Verification in Secrets API
 *
 * Tests the complete flow from session verification to secret creation,
 * ensuring that the foreign key constraint issue is resolved.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/secrets/route';

// Mock modules
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth-config', () => ({
  authConfig: {}
}));

vi.mock('@/lib/encryption', () => ({
  encryptMessage: vi.fn().mockResolvedValue({
    encrypted: 'mock-encrypted-data',
    iv: 'mock-iv',
    authTag: 'mock-auth-tag'
  })
}));

// Create mock instances
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
}

const mockSecretsService = {
  create: vi.fn()
}

vi.mock('@/lib/db/drizzle', () => ({
  getDatabase: vi.fn(() => Promise.resolve(mockDb)),
  db: mockDb, // Keep for backward compatibility
  secretsService: mockSecretsService
}));

vi.mock('@/lib/db/secrets-service-robust', () => ({
  RobustSecretsService: vi.fn().mockImplementation(() => ({
    create: vi.fn()
  }))
}));

import { getServerSession } from 'next-auth/next';
import { db, secretsService } from '@/lib/db/drizzle';

describe('Integration: User Verification in Secrets API', () => {
  const mockUserId = '103890241628354500674';
  const mockUserEmail = 'test@example.com';
  const mockUserName = 'Test User';

  const mockSession = {
    user: {
      id: mockUserId,
      email: mockUserEmail,
      name: mockUserName
    }
  };

  const validSecretData = {
    title: 'Test Secret',
    recipient_name: 'John Doe',
    recipient_email: 'john@example.com',
    contact_method: 'email',
    check_in_days: 30,
    server_share: 'test-server-share',
    sss_shares_total: 3,
    sss_threshold: 2
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should create user and secret when user does not exist in database', async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(mockSession);

    // Mock user doesn't exist (first call) then exists after creation (second call)
    const mockLimit = vi.fn()
      .mockResolvedValueOnce([]) // User doesn't exist by ID
      .mockResolvedValueOnce([]); // User doesn't exist by email either
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

    (db.select as any).mockImplementation(mockSelect);

    // Mock successful user creation
    const mockReturning = vi.fn().mockResolvedValue([{
      id: mockUserId,
      email: mockUserEmail,
      name: mockUserName,
      image: null,
      emailVerified: null,
      password: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

    (db.insert as any).mockImplementation(mockInsert);

    // Mock successful secret creation
    vi.mocked(secretsService.create).mockResolvedValue({
      id: 'new-secret-id',
      userId: mockUserId,
      title: validSecretData.title,
      recipientName: validSecretData.recipient_name,
      recipientEmail: validSecretData.recipient_email,
      contactMethod: validSecretData.contact_method,
      checkInDays: validSecretData.check_in_days,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const request = new NextRequest('http://localhost:3000/api/secrets', {
      method: 'POST',
      body: JSON.stringify(validSecretData)
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(200);

    // Verify user was created
    expect(mockInsert).toHaveBeenCalledWith(expect.anything()); // Called for user creation
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      id: mockUserId,
      email: mockUserEmail,
      name: mockUserName
    }));

    // Verify secret was created
    expect(secretsService.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: mockUserId,
      title: validSecretData.title
    }));

    const responseData = await response.json();
    expect(responseData.secretId).toBe('new-secret-id');
  });

  test('should create secret when user already exists in database', async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(mockSession);

    // Mock user exists in database
    const mockLimit = vi.fn().mockResolvedValue([{
      id: mockUserId,
      email: mockUserEmail,
      name: mockUserName,
      image: null,
      emailVerified: new Date(),
      password: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

    (db.select as any).mockImplementation(mockSelect);

    const mockInsert = vi.fn();
    (db.insert as any).mockImplementation(mockInsert);

    // Mock successful secret creation
    vi.mocked(secretsService.create).mockResolvedValue({
      id: 'new-secret-id',
      userId: mockUserId,
      title: validSecretData.title,
      recipientName: validSecretData.recipient_name,
      recipientEmail: validSecretData.recipient_email,
      contactMethod: validSecretData.contact_method,
      checkInDays: validSecretData.check_in_days,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const request = new NextRequest('http://localhost:3000/api/secrets', {
      method: 'POST',
      body: JSON.stringify(validSecretData)
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(200);

    // Verify user was NOT created (user already existed)
    expect(mockInsert).not.toHaveBeenCalled();

    // Verify secret was created
    expect(secretsService.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: mockUserId,
      title: validSecretData.title
    }));

    const responseData = await response.json();
    expect(responseData.secretId).toBe('new-secret-id');
  });

  test('should return 500 if user verification fails', async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(mockSession);

    // Mock database error during user verification
    const mockLimit = vi.fn().mockRejectedValue(new Error('Database connection failed'));
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

    (db.select as any).mockImplementation(mockSelect);

    const request = new NextRequest('http://localhost:3000/api/secrets', {
      method: 'POST',
      body: JSON.stringify(validSecretData)
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(500);
    const responseData = await response.json();
    expect(responseData.error).toBe('Failed to verify user account');

    // Verify secret creation was not attempted
    expect(secretsService.create).not.toHaveBeenCalled();
  });

  test('should handle foreign key constraint by ensuring user exists first', async () => {
    // This test specifically addresses the original issue:
    // userId '103890241628354500674' from session doesn't exist in users table

    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(mockSession);

    // Simulate the original problem: session has user ID but user doesn't exist in DB
    const mockLimit = vi.fn()
      .mockResolvedValueOnce([]) // User lookup by ID fails
      .mockResolvedValueOnce([]); // User lookup by email also fails

    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

    (db.select as any).mockImplementation(mockSelect);

    // Mock successful user creation (fixing the FK constraint issue)
    const mockReturning = vi.fn().mockResolvedValue([{
      id: mockUserId, // Same ID as session
      email: mockUserEmail,
      name: mockUserName,
      image: null,
      emailVerified: null,
      password: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

    (db.insert as any).mockImplementation(mockInsert);

    // Mock successful secret creation (this would have failed before with FK constraint)
    vi.mocked(secretsService.create).mockResolvedValue({
      id: 'new-secret-id',
      userId: mockUserId, // This should now work because user exists
      title: validSecretData.title,
      recipientName: validSecretData.recipient_name,
      recipientEmail: validSecretData.recipient_email,
      contactMethod: validSecretData.contact_method,
      checkInDays: validSecretData.check_in_days,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const request = new NextRequest('http://localhost:3000/api/secrets', {
      method: 'POST',
      body: JSON.stringify(validSecretData)
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(200);

    // Verify the fix: user was created first, preventing FK constraint violation
    expect(mockInsert).toHaveBeenCalledWith(expect.anything());
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      id: mockUserId // User created with same ID as session
    }));

    // Verify secret creation succeeded (would have failed before the fix)
    expect(secretsService.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: mockUserId // FK constraint satisfied
    }));

    const responseData = await response.json();
    expect(responseData.secretId).toBe('new-secret-id');
  });
});