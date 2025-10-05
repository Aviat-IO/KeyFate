# Email Environment Configuration Guide

Complete guide for configuring email-related environment variables for the Dead Man's Switch application.

## Table of Contents

- [Quick Start](#quick-start)
- [Environment Variables Reference](#environment-variables-reference)
- [Configuration by Environment](#configuration-by-environment)
- [Email Provider Setup](#email-provider-setup)
- [Validation and Testing](#validation-and-testing)
- [Troubleshooting](#troubleshooting)
- [Security Best Practices](#security-best-practices)

## Quick Start

### Development Setup (Mock Provider)

For local development without sending real emails:

```bash
# Minimal development setup
EMAIL_PROVIDER="mock"
CRON_SECRET="dev-secret-at-least-16-chars"
```

The mock provider logs emails to console instead of sending them. No SendGrid credentials required.

### Production Setup (SendGrid)

For production deployment with real email delivery:

```bash
# Production email configuration
EMAIL_PROVIDER="sendgrid"
SENDGRID_API_KEY="SG.your_actual_api_key_from_sendgrid"
SENDGRID_ADMIN_EMAIL="noreply@yourdomain.com"
SENDGRID_SENDER_NAME="Dead Man's Switch"
ADMIN_ALERT_EMAIL="support@yourdomain.com"
CRON_SECRET="your_secure_random_32_char_string"
```

## Environment Variables Reference

### Required Variables

#### `CRON_SECRET`

- **Required:** Always (all environments)
- **Purpose:** Authenticates cron job requests to prevent unauthorized access
- **Format:** String, minimum 16 characters recommended
- **Example:** `"cron-secret-min-16-chars-recommended"`
- **Security:** Use a cryptographically random string in production

#### `SENDGRID_API_KEY` (SendGrid provider only)

- **Required:** When `EMAIL_PROVIDER="sendgrid"`
- **Purpose:** Authenticates with SendGrid API
- **Format:** String starting with `SG.`
- **Example:** `"SG.AbCdEf123456789..."`
- **Where to get:** SendGrid Dashboard → Settings → API Keys

#### `SENDGRID_ADMIN_EMAIL` (SendGrid provider only)

- **Required:** When `EMAIL_PROVIDER="sendgrid"`
- **Purpose:** Sender email address (must be verified in SendGrid)
- **Format:** Valid email address
- **Example:** `"noreply@yourdomain.com"`
- **Setup:** Must be verified in SendGrid Dashboard → Sender Authentication

### Optional Variables

#### `EMAIL_PROVIDER`

- **Required:** No
- **Default:** `"mock"` in development, `"sendgrid"` in production
- **Purpose:** Selects which email provider to use
- **Valid values:** `"sendgrid"`, `"mock"`
- **Example:** `"sendgrid"`

#### `SENDGRID_SENDER_NAME`

- **Required:** No
- **Default:** `"Dead Man's Switch"`
- **Purpose:** Display name shown in recipient's inbox
- **Format:** String
- **Example:** `"Dead Man's Switch"`

#### `ADMIN_ALERT_EMAIL`

- **Required:** No
- **Default:** `"support@aviat.io"`
- **Purpose:** Recipient for system alerts and admin notifications
- **Format:** Valid email address
- **Example:** `"alerts@yourdomain.com"`

## Configuration by Environment

### Development Environment

**Recommended Setup:**

```bash
# .env.local
NODE_ENV="development"
EMAIL_PROVIDER="mock"
CRON_SECRET="dev-secret-at-least-16-chars"
```

**Testing with SendGrid:**

If you want to test real email delivery in development:

```bash
# .env.local
NODE_ENV="development"
EMAIL_PROVIDER="sendgrid"
SENDGRID_API_KEY="SG.your_test_api_key"
SENDGRID_ADMIN_EMAIL="test@yourdomain.com"
CRON_SECRET="dev-secret-at-least-16-chars"
```

### Production Environment

**Required Configuration:**

```bash
# Production environment variables
NODE_ENV="production"
EMAIL_PROVIDER="sendgrid"
SENDGRID_API_KEY="SG.your_production_api_key"
SENDGRID_ADMIN_EMAIL="noreply@yourdomain.com"
SENDGRID_SENDER_NAME="Dead Man's Switch"
ADMIN_ALERT_EMAIL="support@yourdomain.com"
CRON_SECRET="your_cryptographically_random_32_character_secret"
```

### Testing Environment

**Automated Testing:**

```bash
# .env.test
NODE_ENV="test"
EMAIL_PROVIDER="mock"
CRON_SECRET="test-secret-at-least-16-chars"
```

## Email Provider Setup

### SendGrid Setup

1. **Create SendGrid Account**
   - Sign up at [sendgrid.com](https://sendgrid.com)
   - Complete email verification

2. **Generate API Key**
   - Navigate to: Settings → API Keys
   - Click "Create API Key"
   - Choose "Full Access" or restricted access with "Mail Send" permission
   - Copy the key (starts with `SG.`)
   - Store securely - you can't retrieve it later

3. **Verify Sender Email**
   - Navigate to: Settings → Sender Authentication
   - Choose "Single Sender Verification" (easiest) or "Domain Authentication" (recommended for production)
   - For Single Sender:
     - Add your sender email address
     - Verify via email confirmation
   - For Domain Authentication:
     - Follow DNS setup instructions
     - Wait for DNS propagation (up to 48 hours)

4. **Configure Environment**
   ```bash
   SENDGRID_API_KEY="SG.your_api_key_here"
   SENDGRID_ADMIN_EMAIL="your_verified_email@domain.com"
   ```

### Mock Provider Setup

No external setup required. The mock provider:
- Logs emails to console
- Stores sent emails in memory for testing
- Simulates successful delivery
- Perfect for development and testing

```bash
EMAIL_PROVIDER="mock"
```

## Validation and Testing

### Startup Validation

The application validates email configuration at startup:

```typescript
import { validateEmailConfigAtStartup } from '@/lib/email/email-config';

// In your app initialization
validateEmailConfigAtStartup();
```

**Production behavior:**
- Throws error if configuration invalid
- Application won't start with missing required variables

**Development behavior:**
- Logs warnings for missing variables
- Uses defaults and continues

### Runtime Status Check

Check email configuration status at runtime:

```typescript
import { getEmailConfigurationStatus } from '@/lib/email/email-config';

const status = getEmailConfigurationStatus();

if (!status.ready) {
  console.error('Email not configured:', status.missingVars);
  console.log('Remediation:', status.remediation);
}
```

### Manual Validation

Validate configuration programmatically:

```typescript
import { validateEmailEnvironment } from '@/lib/email/email-config';

const validation = validateEmailEnvironment();

if (!validation.valid) {
  console.error('Errors:', validation.errors);
}

if (validation.warnings.length > 0) {
  console.warn('Warnings:', validation.warnings);
}
```

## Troubleshooting

### Common Issues

#### "SENDGRID_API_KEY is required for SendGrid provider"

**Cause:** Missing or empty `SENDGRID_API_KEY` environment variable.

**Solution:**
1. Verify API key is set in `.env` or environment
2. Check for typos in variable name
3. Ensure key starts with `SG.`
4. Verify key wasn't deleted in SendGrid dashboard

#### "SENDGRID_ADMIN_EMAIL is required for SendGrid provider"

**Cause:** Missing sender email address.

**Solution:**
1. Set `SENDGRID_ADMIN_EMAIL` in environment
2. Verify email is verified in SendGrid (Settings → Sender Authentication)
3. Check for typos in email address

#### "CRON_SECRET is required for cron job authentication"

**Cause:** Missing cron secret for securing cron endpoints.

**Solution:**
1. Set `CRON_SECRET` environment variable
2. Use minimum 16 characters
3. Use cryptographically random string in production

#### "CRON_SECRET is too short (minimum 16 characters recommended)"

**Cause:** CRON_SECRET exists but is too short for security.

**Solution:**
1. Generate a longer secret: `openssl rand -base64 24`
2. Update environment variable
3. Restart application

#### "Email configuration invalid" in production

**Cause:** Application startup validation failed.

**Solution:**
1. Check error message for missing variables
2. Verify all required variables are set
3. Test configuration: `npm run validate-email-config` (if available)
4. Review this guide for proper setup

#### SendGrid authentication errors

**Cause:** Invalid API key or insufficient permissions.

**Solution:**
1. Verify API key is correct and not expired
2. Check API key permissions in SendGrid dashboard
3. Ensure "Mail Send" permission is enabled
4. Try generating a new API key

#### SendGrid sender verification errors

**Cause:** Email address not verified in SendGrid.

**Solution:**
1. Complete sender verification in SendGrid dashboard
2. Check spam folder for verification email
3. Ensure email address matches exactly
4. Consider using domain authentication for production

### Debug Mode

Enable detailed logging:

```typescript
// Set environment variable
DEBUG="email:*"

// Or in code
import { getEmailConfigurationStatus } from '@/lib/email/email-config';

const status = getEmailConfigurationStatus();
console.log('Email Config Status:', JSON.stringify(status, null, 2));
```

### Testing Email Delivery

Test email sending in development:

```typescript
import { getEmailProvider } from '@/lib/email/email-factory';

const provider = getEmailProvider();

const result = await provider.sendEmail({
  to: 'test@example.com',
  subject: 'Test Email',
  html: '<p>Test email body</p>',
  text: 'Test email body',
});

console.log('Email result:', result);
```

## Security Best Practices

### API Key Security

1. **Never commit API keys to version control**
   - Use `.env` files (included in `.gitignore`)
   - Use environment variables in deployment platforms
   - Rotate keys regularly

2. **Use restricted API keys**
   - Grant minimum necessary permissions
   - Use "Mail Send" permission only for email sending
   - Create separate keys for different environments

3. **Rotate keys regularly**
   - Set up key rotation schedule (e.g., every 90 days)
   - Keep old key active briefly during rotation
   - Update all environments simultaneously

### CRON_SECRET Security

1. **Generate cryptographically random secrets**
   ```bash
   # Linux/macOS
   openssl rand -base64 32

   # Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. **Use different secrets per environment**
   - Development: Simple but unique
   - Staging: Production-strength random
   - Production: Cryptographically random, rotated regularly

3. **Store secrets securely**
   - Use secret management services (AWS Secrets Manager, Azure Key Vault, etc.)
   - Never log or expose secrets
   - Limit access to production secrets

### Email Security

1. **Verify sender domains**
   - Use domain authentication (not just single sender)
   - Set up SPF, DKIM, and DMARC records
   - Monitor email reputation

2. **Rate limiting**
   - Respect SendGrid rate limits
   - Implement application-level rate limiting
   - Monitor for abuse

3. **Content security**
   - Sanitize email content
   - Avoid user-generated content in emails without validation
   - Use HTML escaping for dynamic content

### Environment Variables

1. **Use .env files for local development**
   ```bash
   # .env (git-ignored)
   SENDGRID_API_KEY="SG.local_dev_key"
   ```

2. **Use platform secret management for production**
   - Vercel: Project Settings → Environment Variables
   - AWS: Systems Manager Parameter Store or Secrets Manager
   - Heroku: Config Vars
   - Docker: Secrets or environment files

3. **Validate on startup**
   - Application validates configuration before accepting requests
   - Fails fast with clear error messages
   - Prevents runtime errors from configuration issues

## Additional Resources

- [SendGrid Documentation](https://docs.sendgrid.com/)
- [SendGrid API Key Permissions](https://docs.sendgrid.com/ui/account-and-settings/api-keys)
- [Sender Authentication Guide](https://docs.sendgrid.com/ui/sending-email/sender-verification)
- [Email Configuration Validation API Reference](../src/lib/email/email-config.ts)

## Support

For issues with email configuration:

1. Check this documentation
2. Review error messages carefully
3. Check SendGrid dashboard for account issues
4. Verify environment variables are set correctly
5. Contact support at the configured `ADMIN_ALERT_EMAIL`
