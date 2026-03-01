<script lang="ts">
  import { page } from '$app/stores';
  import { AlertCircle } from 'lucide-svelte';

  const error = $derived($page.url.searchParams.get('error'));

  function getErrorMessage(): string {
    switch (error) {
      case 'Configuration':
        return 'There is a problem with the server configuration.';
      case 'AccessDenied':
        return 'You do not have permission to sign in.';
      case 'Verification':
        return 'The verification token has expired or has already been used.';
      case 'OAuthSignin':
        return 'Error connecting to the authentication provider.';
      case 'OAuthCallback':
        return 'Error during the authentication process.';
      case 'OAuthCreateAccount':
        return 'Could not create an account with the provided information.';
      case 'EmailCreateAccount':
        return 'Could not create an account with this email address.';
      case 'Callback':
        return 'Error in the authentication callback.';
      case 'OAuthAccountNotLinked':
        return 'This email is already associated with another account. Please sign in using the original method.';
      case 'EmailSignin':
        return 'The email could not be sent. Please try again.';
      case 'CredentialsSignin':
        return 'Sign in failed. Check the details you provided are correct.';
      case 'SessionRequired':
        return 'Please sign in to access this page.';
      default:
        return 'An unexpected error occurred during authentication.';
    }
  }
</script>

<svelte:head>
  <title>Authentication Error - KeyFate</title>
</svelte:head>

<div class="bg-background flex min-h-screen items-center justify-center px-6">
  <div class="w-full max-w-md space-y-8">
    <div class="text-center">
      <div class="bg-destructive/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
        <AlertCircle class="text-destructive h-10 w-10" />
      </div>

      <h1 class="font-space mb-4 text-3xl font-light tracking-tight">Authentication Error</h1>

      <div class="bg-destructive/10 border-destructive/30 mb-8 rounded-lg border p-4">
        <p class="text-sm">{getErrorMessage()}</p>
        {#if error}
          <p class="text-muted-foreground mt-2 text-xs">Error code: {error}</p>
        {/if}
      </div>

      <div class="space-y-3">
        <a
          href="/sign-in"
          class="bg-primary text-primary-foreground hover:bg-primary/90 block w-full rounded-lg px-4 py-2 text-sm font-semibold shadow-sm"
        >
          Try signing in again
        </a>

        <a
          href="/"
          class="border-input text-foreground hover:bg-muted/50 bg-background block w-full rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm"
        >
          Return to home
        </a>
      </div>

      <p class="text-muted-foreground mt-8 text-xs">
        If this error persists, please
        <a href="/support" class="text-primary hover:text-primary/80">contact support</a>
      </p>
    </div>
  </div>
</div>
