/**
 * Integration Tests for User Verification in Check-In API
 *
 * Tests that the check-in API route properly ensures user exists
 * before creating check-in history records.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/secrets/[id]/check-in/route';

// Mock modules
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth-config', () => ({
  authConfig: {}
}));

vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  secretsService: {
    getById: vi.fn(),
    update: vi.fn()
  }
}));

import { getServerSession } from 'next-auth/next';
import { db, secretsService } from '@/lib/db/drizzle';

describe('Check-In API User Verification', () => {
  const mockUserId = '103890241628354500674';
  const mockUserEmail = 'test@example.com';
  const mockUserName = 'Test User';
  const mockSecretId = 'secret-123';

  const mockSession = {
    user: {
      id: mockUserId,
      email: mockUserEmail,
      name: mockUserName
    }
  };

  const mockSecret = {
    id: mockSecretId,
    userId: mockUserId,
    title: 'Test Secret',
    checkInDays: 30,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should ensure user exists before creating check-in history', async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(mockSession);

    // Mock user doesn't exist initially
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

    // Mock secret operations
    vi.mocked(secretsService.getById).mockResolvedValue(mockSecret);
    vi.mocked(secretsService.update).mockResolvedValue({
      ...mockSecret,
      lastCheckIn: expect.any(Date),
      nextCheckIn: expect.any(Date)
    });

    const request = new NextRequest('http://localhost:3000/api/secrets/secret-123/check-in', {
      method: 'POST'
    });

    // Act
    const response = await POST(request, { params: Promise.resolve({ id: mockSecretId }) });

    // Assert
    expect(response.status).toBe(200);

    // Verify user was created first
    expect(mockInsert).toHaveBeenCalledTimes(2); // Once for user, once for check-in history
    expect(mockValues).toHaveBeenNthCalledWith(1, expect.objectContaining({
      id: mockUserId,
      email: mockUserEmail,
      name: mockUserName
    }));

    // Verify check-in history was created
    expect(mockValues).toHaveBeenNthCalledWith(2, expect.objectContaining({
      secretId: mockSecretId,
      userId: mockUserId,
      checkedInAt: expect.any(Date),
      nextCheckIn: expect.any(Date)
    }));

    const responseData = await response.json();
    expect(responseData.success).toBe(true);
  });

  test('should work when user already exists', async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(mockSession);

    // Mock user exists
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

    const mockValues = vi.fn();
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
    (db.insert as any).mockImplementation(mockInsert);

    // Mock secret operations
    vi.mocked(secretsService.getById).mockResolvedValue(mockSecret);
    vi.mocked(secretsService.update).mockResolvedValue({
      ...mockSecret,
      lastCheckIn: expect.any(Date),
      nextCheckIn: expect.any(Date)
    });

    const request = new NextRequest('http://localhost:3000/api/secrets/secret-123/check-in', {
      method: 'POST'
    });

    // Act
    const response = await POST(request, { params: Promise.resolve({ id: mockSecretId }) });

    // Assert
    expect(response.status).toBe(200);

    // Verify user was NOT created (already existed)
    expect(mockInsert).toHaveBeenCalledTimes(1); // Only for check-in history

    // Verify check-in history was created
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      secretId: mockSecretId,
      userId: mockUserId,
      checkedInAt: expect.any(Date),
      nextCheckIn: expect.any(Date)
    }));

    const responseData = await response.json();
    expect(responseData.success).toBe(true);
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

    const request = new NextRequest('http://localhost:3000/api/secrets/secret-123/check-in', {
      method: 'POST'
    });

    // Act
    const response = await POST(request, { params: Promise.resolve({ id: mockSecretId }) });

    // Assert
    expect(response.status).toBe(500);
    const responseData = await response.json();
    expect(responseData.error).toBe('Failed to verify user account');

    // Verify secret operations were not attempted
    expect(secretsService.getById).not.toHaveBeenCalled();
    expect(secretsService.update).not.toHaveBeenCalled();
  });
});