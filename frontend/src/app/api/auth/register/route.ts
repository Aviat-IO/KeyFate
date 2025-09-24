import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/auth/users';
import { validatePassword } from '@/lib/auth/password';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Trim and lowercase email before validation
    email = email.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.message },
        { status: 400 }
      );
    }

    // Create the user
    const result = await createUser({
      email,
      password,
    });

    if (!result.success) {
      // Enhanced error handling with appropriate status codes
      let statusCode = 400;
      let errorMessage = result.error || 'Failed to create user';

      // Check for specific error types
      if (result.error?.includes('already exists') || result.error?.includes('already registered')) {
        statusCode = 409; // Conflict
        errorMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (result.error?.includes('invalid') || result.error?.includes('validation')) {
        statusCode = 422; // Unprocessable Entity
      } else if (result.error?.includes('database') || result.error?.includes('connection')) {
        statusCode = 500; // Internal Server Error
        errorMessage = 'Database error occurred. Please try again later.';
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    }

    // Return success (without password)
    return NextResponse.json(
      {
        success: true,
        user: {
          id: result.user!.id,
          email: result.user!.email,
          name: result.user!.name,
        },
        isExistingUser: result.isExistingUser || false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);

    // Enhanced error logging and response
    let errorMessage = 'Internal server error. Please try again later.';

    if (error instanceof SyntaxError) {
      errorMessage = 'Invalid request format. Please check your data and try again.';
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    } else if (error instanceof TypeError) {
      console.error('Type error in registration:', error);
      errorMessage = 'Invalid data provided. Please check your information.';
      return NextResponse.json(
        { error: errorMessage },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}