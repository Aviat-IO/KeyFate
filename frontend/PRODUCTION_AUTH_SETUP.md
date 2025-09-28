# Production Authentication Setup Checklist

## Google Cloud Console OAuth Configuration

### 1. Authorized JavaScript Origins
Add these URLs to your Google OAuth 2.0 Client ID configuration:
- `https://staging.keyfate.com`
- `https://keyfate.com` (for production)
- `http://localhost:3000` (for development)

### 2. Authorized Redirect URIs
Add these callback URLs:
- `https://staging.keyfate.com/api/auth/callback/google`
- `https://keyfate.com/api/auth/callback/google` (for production)
- `http://localhost:3000/api/auth/callback/google` (for development)

### 3. Environment Variables in Cloud Run

Ensure these are set in your Cloud Run service:
```bash
NEXTAUTH_URL=https://staging.keyfate.com  # Must match your deployment URL exactly
NEXTAUTH_SECRET=<your-32-character-secret>  # Generate with: openssl rand -base64 32
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>
NODE_ENV=production
```

### 4. Terraform Configuration

Verify in `infrastructure/terragrunt/dev/terraform.tfvars`:
```hcl
next_public_site_url = "https://staging.keyfate.com"
```

### 5. Build Command

Always build with:
```bash
NODE_ENV=production pnpm build
```

### 6. Debugging Authentication Issues

If authentication isn't working:

1. **Check Cloud Run Logs**:
```bash
gcloud run services logs read frontend --project=<project-id> --region=<region>
```

2. **Look for these log messages**:
- `[Auth Environment] Configuration:` - Shows if env vars are loaded
- `[Middleware withAuth] Token exists:` - Shows if JWT token is found
- `[OAuth] Initiating Google OAuth flow` - OAuth flow started
- `[OAuth Callback] Google callback received:` - Callback received

3. **Common Issues and Solutions**:

| Issue | Solution |
|-------|----------|
| Redirect loop | Ensure NEXTAUTH_URL matches deployment URL exactly |
| OAuth callback fails | Check Google Console redirect URIs |
| Cookies not set | Verify HTTPS and secure cookie settings |
| Session not persisting | Check NEXTAUTH_SECRET is consistent |

### 7. Testing Authentication

1. **Local Testing**:
```bash
# Set environment variables
export NEXTAUTH_URL=http://localhost:3000
export NEXTAUTH_SECRET=your-dev-secret
export GOOGLE_CLIENT_ID=your-client-id
export GOOGLE_CLIENT_SECRET=your-client-secret

# Run development server
pnpm dev
```

2. **Staging Testing**:
- Navigate to `https://staging.keyfate.com`
- Click "Sign in with Google"
- Should redirect to Google, then back to `/dashboard`
- Check browser DevTools for cookies:
  - Should see `__Secure-next-auth.session-token`

### 8. Cookie Verification

In Chrome DevTools > Application > Cookies:
- **Production**: `__Secure-next-auth.session-token` (Secure, HttpOnly, SameSite=Lax)
- **Development**: `next-auth.session-token` (HttpOnly, SameSite=Lax)

### 9. Environment-Specific Configuration

The auth system automatically detects the environment:
- Uses secure cookies when `NEXTAUTH_URL` starts with `https://`
- Trusts host headers in production (required for Cloud Run)
- Enables debug logging in development

### 10. Monitoring

Set up alerts for:
- High rate of 401/403 errors
- OAuth callback failures
- Session creation failures

## Troubleshooting Commands

```bash
# View current Cloud Run configuration
gcloud run services describe frontend --region=<region> --format="yaml"

# Update environment variable
gcloud run services update frontend \
  --update-env-vars NEXTAUTH_URL=https://staging.keyfate.com \
  --region=<region>

# Check if secure cookies are being set
curl -I https://staging.keyfate.com/api/auth/providers

# Test OAuth flow
curl https://staging.keyfate.com/api/auth/signin
```

## Important Notes

1. **Never commit secrets**: Keep `NEXTAUTH_SECRET` and `GOOGLE_CLIENT_SECRET` in Secret Manager
2. **URL consistency**: `NEXTAUTH_URL` must exactly match your deployment URL
3. **Cookie domain**: Don't set a cookie domain unless using subdomains
4. **HTTPS required**: Production must use HTTPS for secure cookies
5. **Session strategy**: We use JWT strategy for stateless auth (no database sessions)