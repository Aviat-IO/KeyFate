<script lang="ts">
  import { page } from '$app/stores';
  import { signIn } from '@auth/sveltekit/client';

  type AuthStep = 'email' | 'otp';

  let authStep = $state<AuthStep>('email');
  let email = $state('');
  let otpCode = $state('');
  let isLoading = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');
  let resendCountdown = $state(0);
  let turnstileToken = $state<string | null>(null);

  let emailInputRef = $state<HTMLInputElement | null>(null);

  const callbackUrl = $derived($page.url.searchParams.get('callbackUrl') || '/dashboard');
  const urlError = $derived($page.url.searchParams.get('error'));

  $effect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => (resendCountdown = resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  });

  $effect(() => {
    if (authStep === 'email' && emailInputRef) {
      emailInputRef.focus();
    }
  });

  function getErrorMessage(error: string | null, customError: string): string | null {
    if (customError) return customError;
    if (!error) return null;

    switch (error) {
      case 'CredentialsSignin':
        return 'Invalid email or password. Please check your credentials and try again.';
      case 'OAuthSignin':
        return 'Error connecting to sign-in provider. Please try again.';
      case 'OAuthCallback':
        return 'Error during authentication. Please try again.';
      case 'OAuthCreateAccount':
        return 'Could not create account. Please try again.';
      case 'EmailCreateAccount':
        return 'Could not create email account. Please try again.';
      case 'Callback':
        return 'Error in authentication callback. Please try again.';
      case 'OAuthAccountNotLinked':
        return 'Account not linked. Please use the same sign-in method you used before.';
      case 'EmailSignin':
        return 'Check your email address and try again.';
      case 'SessionRequired':
        return 'Please sign in to access this page.';
      default:
        return 'Unable to sign in. Please try again.';
    }
  }

  async function handleRequestOTP(e: SubmitEvent) {
    e.preventDefault();
    isLoading = true;
    errorMessage = '';
    successMessage = '';

    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          acceptedPrivacyPolicy: true,
          turnstileToken
        })
      });

      const data = await response.json();

      if (response.ok) {
        successMessage = `Code sent to ${email}\nCheck your email`;
        authStep = 'otp';
        resendCountdown = 60;
      } else if (response.status === 429) {
        errorMessage = data.resetAt
          ? `Too many requests. Please try again in ${Math.ceil((new Date(data.resetAt).getTime() - Date.now()) / 60000)} minutes.`
          : 'Too many requests. Please try again later.';
      } else {
        errorMessage = data.error || 'Failed to send code. Please try again.';
      }
    } catch (error) {
      console.error('Request OTP error:', error);
      errorMessage = 'An unexpected error occurred. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function handleVerifyOTP(code: string) {
    isLoading = true;
    errorMessage = '';

    try {
      const csrfResponse = await fetch('/api/auth/csrf');
      const { csrfToken } = await csrfResponse.json();

      const formData = new URLSearchParams({
        csrfToken,
        email: email.toLowerCase().trim(),
        otpCode: code,
        action: 'otp',
        callbackUrl
      });

      const authResponse = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      if (
        authResponse.url.includes(callbackUrl) ||
        authResponse.url.includes('/dashboard')
      ) {
        window.location.href = callbackUrl;
      } else if (
        authResponse.url.includes('/auth/signin') ||
        authResponse.url.includes('error=')
      ) {
        errorMessage = 'Invalid or expired code. Please try again.';
        otpCode = '';
      } else {
        const sessionResponse = await fetch('/api/auth/session');
        const session = await sessionResponse.json();

        if (session?.user) {
          window.location.href = callbackUrl;
        } else {
          errorMessage = 'Invalid or expired code. Please try again.';
          otpCode = '';
        }
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      errorMessage = 'An unexpected error occurred. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  function handleEditEmail() {
    authStep = 'email';
    otpCode = '';
    errorMessage = '';
    successMessage = '';
  }

  async function handleResendOTP() {
    if (resendCountdown > 0) return;
    turnstileToken = null;

    isLoading = true;
    errorMessage = '';
    successMessage = '';

    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          acceptedPrivacyPolicy: true,
          turnstileToken: null
        })
      });

      const data = await response.json();

      if (response.ok) {
        successMessage = `Code sent to ${email}\nCheck your email`;
        resendCountdown = 60;
      } else if (response.status === 429) {
        errorMessage = data.resetAt
          ? `Too many requests. Please try again in ${Math.ceil((new Date(data.resetAt).getTime() - Date.now()) / 60000)} minutes.`
          : 'Too many requests. Please try again later.';
      } else {
        errorMessage = data.error || 'Failed to send code. Please try again.';
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      errorMessage = 'An unexpected error occurred. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function handleGoogleSignIn() {
    isLoading = true;
    errorMessage = '';
    try {
      await signIn('google', { callbackUrl });
    } catch (error) {
      console.error('Google sign in error:', error);
      errorMessage = 'Google sign-in failed. Please try again.';
      isLoading = false;
    }
  }

  function handleOtpInput(e: Event) {
    const target = e.target as HTMLInputElement;
    otpCode = target.value.replace(/\D/g, '').slice(0, 8);
    if (otpCode.length === 8) {
      handleVerifyOTP(otpCode);
    }
  }
</script>

<svelte:head>
  <title>Sign In - KeyFate</title>
</svelte:head>

<div class="bg-background -mx-4 flex min-h-screen items-center justify-center py-8">
  <div
    class="bg-card border-border my-auto w-full max-w-lg space-y-6 rounded-xl border p-6 shadow-lg sm:space-y-8 sm:p-8"
  >
    <div>
      <h2 class="text-foreground mt-6 text-center text-3xl font-extrabold">Sign in to KeyFate</h2>
      <p class="text-muted-foreground mt-2 text-center text-sm">Secure your digital legacy</p>
    </div>

    {#if getErrorMessage(urlError, errorMessage)}
      <div class="border-destructive bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
        {getErrorMessage(urlError, errorMessage)}
      </div>
    {/if}

    {#if successMessage}
      <div
        class="border-accent bg-accent/10 text-accent-foreground whitespace-pre-line rounded-lg border px-4 py-3 text-center text-sm"
      >
        {successMessage}
      </div>
    {/if}

    <div class="mt-8 space-y-6">
      {#if authStep === 'email'}
        <form onsubmit={handleRequestOTP} class="space-y-4">
          <div>
            <label for="email" class="text-foreground block text-sm font-medium">Email address</label>
            <input
              bind:this={emailInputRef}
              id="email"
              name="email"
              type="email"
              autocomplete="email"
              required
              bind:value={email}
              class="border-input text-foreground placeholder-muted-foreground focus:border-primary focus:ring-primary relative mt-1 block w-full appearance-none rounded-lg border px-3 py-2 focus:z-10 focus:outline-none sm:text-sm"
              placeholder="you@example.com"
              disabled={isLoading}
            />
          </div>

          <!-- Turnstile placeholder - implement when component is ported -->

          <button
            type="submit"
            disabled={isLoading}
            class="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring group relative flex w-full justify-center rounded-lg border border-transparent px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Sending code...' : 'Continue with Email'}
          </button>

          <p class="text-muted-foreground text-center text-xs">
            By continuing, you accept our
            <a href="/terms-of-service" target="_blank" class="text-primary hover:underline"
              >Terms of Service</a
            >
            and
            <a href="/privacy-policy" target="_blank" class="text-primary hover:underline"
              >Privacy Policy</a
            >
          </p>
        </form>
      {:else}
        <div class="space-y-4">
          <div>
            <label for="otp" class="text-foreground mb-2 block text-sm font-medium"
              >Enter 8-digit code</label
            >
            <input
              id="otp"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength={8}
              value={otpCode}
              oninput={handleOtpInput}
              disabled={isLoading}
              class="border-input text-foreground focus:border-primary focus:ring-primary mt-1 block w-full rounded-lg border px-3 py-2 text-center text-2xl tracking-[0.5em] focus:outline-none sm:text-3xl"
              placeholder="00000000"
            />
          </div>

          <div class="text-center">
            {#if resendCountdown > 0}
              <p class="text-muted-foreground text-sm">Resend code in {resendCountdown}s</p>
            {:else}
              <button
                onclick={handleResendOTP}
                disabled={isLoading}
                class="text-primary hover:text-primary text-sm font-medium disabled:opacity-50"
              >
                Resend code
              </button>
            {/if}
          </div>

          <div class="border-muted bg-muted text-muted-foreground rounded-lg border px-4 py-3 text-sm">
            <p class="font-medium">Didn't receive the code?</p>
            <ul class="mt-1 list-inside list-disc space-y-1 text-xs">
              <li>Check your spam folder</li>
              <li>Codes expire after 5 minutes</li>
              <li>Wait 60 seconds before requesting a new code</li>
            </ul>
          </div>
        </div>
      {/if}

      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <div class="border-input w-full border-t"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="text-muted-foreground bg-card px-2">Or continue with</span>
        </div>
      </div>

      <!-- Google Sign In -->
      <button
        onclick={handleGoogleSignIn}
        disabled={isLoading}
        class="border-input text-foreground hover:bg-secondary focus:ring-ring bg-card flex w-full items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg class="mr-2 h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
          <path d="M1 1h22v22H1z" fill="none" />
        </svg>
        {isLoading ? 'Signing in...' : 'Sign in with Google'}
      </button>
    </div>
  </div>
</div>
