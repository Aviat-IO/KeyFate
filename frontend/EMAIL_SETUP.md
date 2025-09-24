# Email Service Setup Guide

This guide helps you configure production email delivery for the Dead Man's Switch application.

## Overview

The application supports multiple email providers with automatic failover and development mode support:

- **SendGrid** (Recommended for production)
- **Resend** (Modern alternative)
- **SMTP** (Generic SMTP servers)
- **Console Logging** (Development mode)

## Environment Variables

### SendGrid Configuration (Recommended)

```bash
# SendGrid API Configuration
SENDGRID_API_KEY=SG.your-sendgrid-api-key-here
SENDGRID_ADMIN_EMAIL=noreply@yourdomain.com
SENDGRID_SENDER_NAME="Your App Name"

# Optional: Specify email provider
EMAIL_PROVIDER=sendgrid
```

### Resend Configuration (Alternative)

```bash
# Resend API Configuration
RESEND_API_KEY=re_your-resend-api-key-here
RESEND_SENDER_EMAIL=noreply@yourdomain.com
RESEND_SENDER_NAME="Your App Name"

# Set provider
EMAIL_PROVIDER=resend
```

### Generic SMTP Configuration

```bash
# SMTP Server Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_SENDER_EMAIL=noreply@yourdomain.com
SMTP_SENDER_NAME="Your App Name"

# Set provider
EMAIL_PROVIDER=smtp
```

### Development Configuration

```bash
# Development mode (console logging)
NODE_ENV=development

# Optional: Test with real email provider in development
SENDGRID_API_KEY=SG.test-key-here
SENDGRID_ADMIN_EMAIL=test@yourdomain.com
```

## Provider Setup Instructions

### 1. SendGrid Setup (Recommended)

1. **Create SendGrid Account**
   - Sign up at https://sendgrid.com
   - Verify your email and complete setup

2. **Create API Key**
   - Go to Settings → API Keys
   - Create a new API key with "Full Access" or "Mail Send" permissions
   - Copy the API key to `SENDGRID_API_KEY`

3. **Domain Authentication**
   - Go to Settings → Sender Authentication
   - Set up domain authentication for better deliverability
   - Add SPF and DKIM records to your DNS

4. **Sender Identity**
   - Set up a verified sender email address
   - Use this email for `SENDGRID_ADMIN_EMAIL`

### 2. Resend Setup (Alternative)

1. **Create Resend Account**
   - Sign up at https://resend.com
   - Complete email verification

2. **Get API Key**
   - Go to API Keys section
   - Create a new API key
   - Copy to `RESEND_API_KEY`

3. **Domain Verification**
   - Add your domain in the Domains section
   - Add required DNS records for verification

### 3. SMTP Setup (Generic)

For Gmail App Passwords:

1. **Enable 2FA**
   - Enable two-factor authentication on your Google account

2. **Generate App Password**
   - Go to Google Account Settings → Security
   - Generate an app-specific password
   - Use this password for `SMTP_PASS`

For other SMTP providers, consult their documentation for connection details.

## Configuration Validation

The application will automatically validate your email configuration on startup:

```bash
# Check email configuration
npm run dev

# Look for email configuration logs:
# ✅ Email service configured: sendgrid
# ❌ Email configuration invalid: SENDGRID_API_KEY missing
```

## Testing Email Delivery

### Development Testing

```bash
# Test verification email in development
curl -X POST http://localhost:3000/api/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Production Testing

1. **Verification Emails**
   - Create a test account
   - Check email delivery and formatting
   - Verify links work correctly

2. **Reminder Emails**
   - Create a test secret with short reminder intervals
   - Verify email content and urgency levels

3. **Disclosure Emails**
   - Test manual disclosure functionality
   - Verify security warnings and content formatting

## Email Templates

The application includes professional email templates for:

### Verification Emails
- Welcome message with verification link
- 24-hour expiration notice
- Support contact information
- Mobile-responsive design

### Reminder Emails
- Urgency-based styling (📅 → 🚨)
- Time-remaining calculations
- Direct check-in links
- Security warnings for critical reminders

### Disclosure Emails
- Confidentiality warnings
- Sender information and last-seen dates
- Secure content formatting
- Professional security notices

## Rate Limiting

Built-in rate limiting protects against abuse:

- **Verification**: 5/hour, 20/day per user
- **Reminders**: 10/hour, 100/day per user
- **Disclosures**: 5/hour, 50/day per user

## Monitoring and Logging

### Email Delivery Logs

```bash
# Check email delivery status
tail -f logs/email.log

# Example log entries:
[EmailService] Verification email sent to user@example.com via sendgrid (Message ID: 123)
[EmailService] Rate limit exceeded for user@example.com (verification)
[EmailService] Failed to send email: Invalid API key
```

### Error Handling

The system implements:
- **Exponential backoff** for transient failures
- **Automatic retries** for rate limits
- **Fallback providers** if configured
- **Console logging** in development mode

## Security Considerations

### Production Security

1. **API Key Protection**
   - Store API keys in secure environment variables
   - Never commit API keys to version control
   - Rotate API keys regularly

2. **Domain Authentication**
   - Set up SPF, DKIM, and DMARC records
   - Use dedicated sending domains
   - Monitor domain reputation

3. **Content Security**
   - Email templates include security warnings
   - Sensitive content is clearly marked
   - Disclosure emails have confidentiality notices

### Development Security

1. **Test Data**
   - Never use production API keys in development
   - Use test emails for development testing
   - Clear test data regularly

2. **Environment Isolation**
   - Separate development and production configurations
   - Use different sender emails for each environment

## Troubleshooting

### Common Issues

1. **"Invalid API Key" Error**
   ```bash
   # Check API key format
   echo $SENDGRID_API_KEY | grep "SG\."

   # Verify API key permissions in SendGrid dashboard
   ```

2. **"Rate Limit Exceeded" Error**
   ```bash
   # Check current rate limits
   # Wait for reset period or upgrade plan
   ```

3. **"Email Not Delivered" Issue**
   ```bash
   # Check spam folder
   # Verify domain authentication
   # Check sender reputation
   ```

4. **Development Mode Not Working**
   ```bash
   # Verify NODE_ENV setting
   echo $NODE_ENV

   # Check console output for email logs
   ```

### Support Contacts

- **SendGrid Support**: https://support.sendgrid.com
- **Resend Support**: https://resend.com/support
- **Application Issues**: Check GitHub issues or contact development team

## Migration from Supabase

If migrating from Supabase Auth emails:

1. **Update Environment Variables**
   - Remove Supabase email configuration
   - Add new email provider configuration

2. **Test Email Templates**
   - Verify new template formatting
   - Update any custom styling if needed

3. **Update Rate Limits**
   - Adjust rate limits based on provider limits
   - Monitor usage in first few days

4. **DNS Updates**
   - Update SPF records if changing providers
   - Add new DKIM records as needed

---

**Note**: This email system replaces the placeholder implementation and provides production-ready email delivery with proper error handling, rate limiting, and professional templates.