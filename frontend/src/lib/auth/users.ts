import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from './password';
import { createVerificationToken, sendVerificationEmail } from './email-verification';
// Use web-standard crypto.randomUUID() for Edge Runtime compatibility

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

export interface AuthenticateUserInput {
  email: string;
  password: string;
}

/**
 * Create a new user with email and password, or auto-login if user exists with same password
 * @param input - User creation data
 * @returns Promise<{success: boolean, user?: User, error?: string, isExistingUser?: boolean}>
 */
export async function createUser(input: CreateUserInput): Promise<{
  success: boolean;
  user?: typeof users.$inferSelect;
  error?: string;
  isExistingUser?: boolean;
}> {
  try {
    // Check if user already exists
    const normalizedEmail = input.email.toLowerCase().trim();
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser.length > 0) {
      // User exists, try to authenticate with provided password
      const authResult = await authenticateUser({
        email: normalizedEmail,
        password: input.password,
      });

      if (authResult.success) {
        // Password matches - auto-login the existing user
        return {
          success: true,
          user: authResult.user,
          isExistingUser: true,
        };
      } else {
        // Password doesn't match - return error
        return {
          success: false,
          error: 'An account with this email already exists. Please sign in instead.',
        };
      }
    }

    // Hash the password
    const hashedPassword = await hashPassword(input.password);

    // Create the user
    const userData = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      name: input.name || null,
      password: hashedPassword,
      emailVerified: null, // Require email verification for credentials login
    };

    const newUser = await db
      .insert(users)
      .values(userData)
      .returning();

    const user = newUser[0];
    if (!user) {
      return {
        success: false,
        error: 'Failed to create user',
      };
    }

    // Send verification email for new users
    try {
      const tokenResult = await createVerificationToken(normalizedEmail);
      if (tokenResult.success && tokenResult.token) {
        await sendVerificationEmail(normalizedEmail, tokenResult.token);
        console.log(`[CreateUser] Verification email sent to: ${normalizedEmail}`);
      } else {
        console.warn(`[CreateUser] Failed to create verification token: ${tokenResult.error}`);
      }
    } catch (emailError) {
      console.error('[CreateUser] Error sending verification email:', emailError);
      // Don't fail user creation if email sending fails
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return {
      success: true,
      user: userWithoutPassword as typeof users.$inferSelect,
      isExistingUser: false,
    };
  } catch (error) {
    console.error('Error creating user:', error);
    return {
      success: false,
      error: 'Failed to create user',
    };
  }
}

/**
 * Authenticate user with email and password
 * @param input - Authentication data
 * @returns Promise<{success: boolean, user?: User, error?: string}>
 */
export async function authenticateUser(input: AuthenticateUserInput): Promise<{
  success: boolean;
  user?: typeof users.$inferSelect;
  error?: string;
}> {
  try {
    // Find user by email
    const normalizedEmail = input.email.toLowerCase().trim();
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    const user = result[0];
    if (!user || !user.password) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    // Verify password
    const isValidPassword = await verifyPassword(input.password, user.password);
    if (!isValidPassword) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return {
      success: true,
      user: userWithoutPassword as typeof users.$inferSelect,
    };
  } catch (error) {
    console.error('Error authenticating user:', error);
    return {
      success: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Get user by email
 * @param email - User email
 * @returns Promise<User | null>
 */
export async function getUserByEmail(email: string): Promise<typeof users.$inferSelect | null> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    const user = result[0];
    if (!user) {
      return null;
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as typeof users.$inferSelect;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
}

/**
 * Get user by ID
 * @param id - User ID
 * @returns Promise<User | null>
 */
export async function getUserById(id: string): Promise<typeof users.$inferSelect | null> {
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    const user = result[0];
    if (!user) {
      return null;
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as typeof users.$inferSelect;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}