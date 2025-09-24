# Google OAuth Implementation

This directory contains the complete Google OAuth implementation for the Dead Man's Switch application, replacing the previous Supabase authentication system.

## Overview

The OAuth implementation provides secure Google authentication using NextAuth.js with comprehensive validation, error handling, and configuration management.

## Files

### Core Implementation

- `oauth-service.ts` - Main OAuth service with Google OAuth flow implementation
- `oauth-config-validator.ts` - Configuration validation utilities
- `../auth-config.ts` - NextAuth configuration with Google provider

### API Routes

- `../app/api/auth/[...nextauth]/route.ts` - NextAuth API endpoints

### Tests

- `__tests__/oauth.test.ts` - Unit tests for OAuth service functions
- `__tests__/oauth-integration.test.ts` - Integration tests for environment configuration
- `__tests__/oauth-config-validator.test.ts` - Tests for configuration validation

## Features

### 🔐 Authentication Flow

- **Google OAuth Integration**: Complete OAuth 2.0 flow with Google
- **Session Management**: JWT-based sessions with NextAuth.js
- **Callback Handling**: Secure OAuth callback processing
- **State Validation**: CSRF protection with state parameter validation

### 🛡️ Security

- **Email Verification**: Requires verified Google accounts
- **State Parameter Protection**: CSRF protection during OAuth flow
- **Secure Session Storage**: JWT tokens with configurable expiration
- **Environment Validation**: Runtime configuration validation

### 🧪 Testing

- **Comprehensive Test Coverage**: 21 tests covering all OAuth functionality
- **Mock Integration**: Proper NextAuth mocking for unit tests
- **Environment Testing**: Tests for proper configuration setup
- **Integration Testing**: Real environment variable validation

## Configuration

### Required Environment Variables

Add these to your `.env.local` file:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# NextAuth Configuration
NEXTAUTH_SECRET=your-secure-secret-here
NEXTAUTH_URL=http://localhost:3000
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)

## Usage

### Basic OAuth Flow

```typescript
import { googleOAuthFlow } from '@/lib/auth/oauth-service'

// Initiate Google OAuth
const result = await googleOAuthFlow({ redirectTo: '/dashboard' })

if (result.success) {
  // OAuth initiated successfully
} else {
  console.error('OAuth failed:', result.error)
}
```

### Session Validation

```typescript
import { handleOAuthCallback } from '@/lib/auth/oauth-service'

// Validate OAuth callback
const result = await handleOAuthCallback()

if (result.success) {
  console.log('User:', result.user)
} else {
  console.error('Validation failed:', result.error)
}
```

### Configuration Validation

```typescript
import { validateOAuthConfig, isOAuthConfigured } from '@/lib/auth/oauth-config-validator'

// Check if OAuth is properly configured
if (!isOAuthConfigured()) {
  console.error('OAuth configuration incomplete')
}

// Detailed validation
const validation = validateOAuthConfig()
if (!validation.isValid) {
  console.error('Errors:', validation.errors)
  console.warn('Warnings:', validation.warnings)
}
```

## API Reference

### OAuth Service

#### `googleOAuthFlow(options?)`

Initiates Google OAuth authentication flow.

**Parameters:**
- `options.redirectTo` (string, optional): URL to redirect after successful authentication

**Returns:** `Promise<OAuthResult>`

#### `handleOAuthCallback()`

Handles OAuth callback and validates the session.

**Returns:** `Promise<OAuthResult>`

#### `validateOAuthState(received, expected)`

Validates OAuth state parameter for CSRF protection.

**Parameters:**
- `received` (string): State parameter from callback
- `expected` (string): Expected state value

**Returns:** `StateValidation`

### Configuration Validator

#### `validateOAuthConfig(config?)`

Validates OAuth configuration.

**Parameters:**
- `config` (OAuthConfig, optional): Configuration to validate

**Returns:** `ValidationResult`

#### `isOAuthConfigured()`

Checks if OAuth is properly configured.

**Returns:** `boolean`

## Testing

Run OAuth tests:

```bash
# All OAuth tests
npm test src/lib/auth/__tests__/

# Specific test files
npm test src/lib/auth/__tests__/oauth.test.ts
npm test src/lib/auth/__tests__/oauth-integration.test.ts
npm test src/lib/auth/__tests__/oauth-config-validator.test.ts
```

## Error Handling

The implementation includes comprehensive error handling:

- **Configuration Errors**: Runtime validation with helpful error messages
- **OAuth Errors**: Proper error propagation from NextAuth
- **Network Errors**: Graceful handling of connection issues
- **State Validation**: CSRF protection with clear error messages

## Migration from Supabase

This implementation replaces the previous Supabase authentication system:

- ✅ Google OAuth authentication
- ✅ Session management
- ✅ Email verification (via Google)
- ✅ Secure callback handling
- ✅ Comprehensive testing
- ✅ Configuration validation

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   - Check `.env.local` file has all required variables
   - Verify Google Client ID format (ends with `.apps.googleusercontent.com`)

2. **OAuth Configuration Errors**
   - Run configuration validator: `validateOAuthConfig()`
   - Check Google Cloud Console settings

3. **Test Failures**
   - Ensure test environment variables are set in `vitest.config.mts`
   - Verify NextAuth mocking is working properly

### Development Tips

- Use `DEBUG_MODE=true` for detailed OAuth logging
- Check browser developer tools for OAuth redirect issues
- Verify redirect URIs match Google Cloud Console configuration

## Security Considerations

- Always use HTTPS in production
- Rotate secrets regularly
- Monitor OAuth callback URLs
- Validate all user inputs
- Keep NextAuth.js updated

## Performance

- JWT sessions for faster authentication
- Minimal external dependencies
- Efficient error handling
- Optimized test suite