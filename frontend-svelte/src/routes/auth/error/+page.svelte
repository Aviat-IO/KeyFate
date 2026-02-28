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

<div
  class="from-background to-secondary flex min-h-screen items-center justify-center bg-gradient-to-br px-4"
>
  <div class="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg dark:bg-card">
    <div class="text-center">
      <div class="bg-destructive/10 mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full">
        <AlertCircle class="text-destructive h-12 w-12" />
      </div>

      <h1 class="text-foreground mb-4 text-3xl font-bold">Authentication Error</h1>

      <div class="bg-destructive/10 border-destructive mb-6 rounded-lg border p-4">
        <p class="text-destructive-foreground text-sm">{getErrorMessage()}</p>
        {#if error}
          <p class="text-destructive mt-2 text-xs">Error code: {error}</p>
        {/if}
      </div>

      <div class="space-y-3">
        <a
          href="/sign-in"
          class="from-primary to-primary hover:from-primary hover:to-primary focus:ring-primary block w-full rounded-lg border border-transparent bg-gradient-to-r px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
        >
          Try signing in again
        </a>

        <a
          href="/"
          class="border-input text-foreground hover:bg-muted/50 focus:ring-primary block w-full rounded-lg border bg-white px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 dark:bg-card"
        >
          Return to home
        </a>
      </div>

      <p class="text-muted-foreground mt-6 text-xs">
        If this error persists, please
        <a href="/support" class="text-primary hover:text-primary">contact support</a>
      </p>
    </div>
  </div>
</div>
