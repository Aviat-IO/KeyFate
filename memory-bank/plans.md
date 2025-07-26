# Plans

## Google OAuth

### 1. Google Cloud Console Setup

1. Go to Google Cloud Console
2. Create/select project
3. Go to OAuth Consent Screen
   - Add Supabase project domain (`<PROJECT_ID>.supabase.co`) to authorized domains
   - Configure non-sensitive scopes:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
4. Create OAuth Client ID:
   - Choose "Web application"
   - Add site URL to Authorized JavaScript origins
   - Add Supabase callback URL to Authorized redirect URLs
   - Save Client ID and Secret

### 2. Supabase Configuration

1. Go to Supabase Dashboard > Auth > Providers > Google
2. Add Client ID and Secret from Google Cloud Console
3. Save configuration

### 3. Frontend Implementation

1. Update `social-buttons.tsx` to include PKCE flow:

   ```typescript
   await supabase.auth.signInWithOAuth({
     provider: 'google',
     options: {
       queryParams: {
         access_type: 'offline',
         prompt: 'consent',
       },
     },
   })
   ```

### 4. Testing Checklist

1. Visit login page
2. Click Google sign in
3. Verify:
   - Redirect to Google consent
   - Successful callback
   - Session creation
   - Access to protected routes

### 5. Troubleshooting

- Invalid client error: Verify client ID and secret match in both Google Cloud Console and Supabase
- Redirect errors: Check authorized redirect URLs in Google Cloud Console
- Session issues: Verify callback route is handling code exchange correctly
