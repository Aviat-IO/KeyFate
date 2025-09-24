import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/auth/register/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth/users', () => ({
  createUser: vi.fn(),
}));

vi.mock('@/lib/auth/password', () => ({
  validatePassword: vi.fn(),
}));

describe('/api/auth/register API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully register a new user', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { validatePassword } = await import('@/lib/auth/password');

    // Mock successful validation and user creation
    (validatePassword as any).mockReturnValue({ isValid: true });
    (createUser as any).mockResolvedValue({
      success: true,
      user: {
        id: 'test-id',
        email: 'test@example.com',
        name: null,
      },
      isExistingUser: false,
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'StrongPassword123',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.user.email).toBe('test@example.com');
    expect(data.isExistingUser).toBe(false);
    expect(data.user.password).toBeUndefined();

    expect(createUser).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'StrongPassword123',
    });
  });

  it('should handle auto-login for existing user', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { validatePassword } = await import('@/lib/auth/password');

    // Mock successful validation and existing user auto-login
    (validatePassword as any).mockReturnValue({ isValid: true });
    (createUser as any).mockResolvedValue({
      success: true,
      user: {
        id: 'existing-id',
        email: 'existing@example.com',
        name: 'Existing User',
      },
      isExistingUser: true,
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'CorrectPassword123',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.user.email).toBe('existing@example.com');
    expect(data.isExistingUser).toBe(true);
    expect(data.user.password).toBeUndefined();
  });

  it('should reject registration without email', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        password: 'StrongPassword123',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Email and password are required');
  });

  it('should reject registration without password', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Email and password are required');
  });

  it('should reject weak passwords', async () => {
    const { validatePassword } = await import('@/lib/auth/password');

    // Mock password validation failure
    (validatePassword as any).mockReturnValue({
      isValid: false,
      message: 'Password must contain at least 8 characters, uppercase, lowercase, and a number',
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'weak',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Password must contain at least 8 characters, uppercase, lowercase, and a number');

    expect(validatePassword).toHaveBeenCalledWith('weak');
  });

  it('should handle user creation failure', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { validatePassword } = await import('@/lib/auth/password');

    // Mock successful validation but failed user creation
    (validatePassword as any).mockReturnValue({ isValid: true });
    (createUser as any).mockResolvedValue({
      success: false,
      error: 'User with this email already exists',
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'WrongPassword123',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409); // Conflict status for existing user
    expect(data.error).toBe('An account with this email already exists. Please sign in instead.');
  });

  it('should handle database errors gracefully', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { validatePassword } = await import('@/lib/auth/password');

    // Mock successful validation but database error
    (validatePassword as any).mockReturnValue({ isValid: true });
    (createUser as any).mockRejectedValue(new Error('Database connection failed'));

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'StrongPassword123',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error. Please try again later.');
  });

  it('should handle malformed JSON gracefully', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: 'invalid json{',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400); // SyntaxError returns 400
    expect(data.error).toBe('Invalid request format. Please check your data and try again.');
  });

  it('should trim and lowercase email', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { validatePassword } = await import('@/lib/auth/password');

    // Mock successful validation and user creation
    (validatePassword as any).mockReturnValue({ isValid: true });
    (createUser as any).mockResolvedValue({
      success: true,
      user: {
        id: 'test-id',
        email: 'test@example.com',
        name: null,
      },
      isExistingUser: false,
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: '  TEST@EXAMPLE.COM  ', // Mixed case with spaces
        password: 'StrongPassword123',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith({
      email: 'test@example.com', // Should be trimmed and lowercased
      password: 'StrongPassword123',
    });
  });

  it('should not accept or process name field', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { validatePassword } = await import('@/lib/auth/password');

    // Mock successful validation and user creation
    (validatePassword as any).mockReturnValue({ isValid: true });
    (createUser as any).mockResolvedValue({
      success: true,
      user: {
        id: 'test-id',
        email: 'test@example.com',
        name: null,
      },
      isExistingUser: false,
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'StrongPassword123',
        name: 'Test User', // This should be ignored
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    // Verify that createUser was NOT called with a name
    expect(createUser).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'StrongPassword123',
      // No name field should be passed
    });
  });

  it('should return consistent response structure', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { validatePassword } = await import('@/lib/auth/password');

    // Mock successful validation and user creation
    (validatePassword as any).mockReturnValue({ isValid: true });
    (createUser as any).mockResolvedValue({
      success: true,
      user: {
        id: 'test-id',
        email: 'test@example.com',
        name: null,
        emailVerified: new Date(),
        image: null,
      },
      isExistingUser: false,
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'StrongPassword123',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual({
      success: true,
      user: {
        id: 'test-id',
        email: 'test@example.com',
        name: null,
      },
      isExistingUser: false,
    });

    // Verify sensitive fields are not returned
    expect(data.user.password).toBeUndefined();
    expect(data.user.emailVerified).toBeUndefined();
  });
});