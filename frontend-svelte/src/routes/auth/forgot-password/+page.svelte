<script lang="ts">
  import { AlertCircle, CheckCircle2 } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Alert from '$lib/components/ui/alert';

  let email = $state('');
  let loading = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    error = null;
    success = false;

    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (res.ok) {
        success = true;
        email = '';
      } else {
        error = data.error || 'Failed to send reset email';
      }
    } catch (err) {
      console.error('Password reset request error:', err);
      error = 'An unexpected error occurred. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Forgot Password - KeyFate</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center px-4">
  <div class="w-full max-w-md space-y-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold">Reset your password</h1>
      <p class="text-muted-foreground mt-1 text-sm">
        Enter your email address and we'll send you a link to reset your password.
      </p>
    </div>

    {#if error}
      <Alert.Root variant="destructive">
        <AlertCircle class="h-4 w-4" />
        <Alert.Description>{error}</Alert.Description>
      </Alert.Root>
    {/if}

    {#if success}
      <Alert.Root class="border-accent bg-accent text-accent-foreground">
        <CheckCircle2 class="h-4 w-4" />
        <Alert.Description>
          If an account exists with that email, we've sent password reset instructions. Please check
          your inbox.
        </Alert.Description>
      </Alert.Root>
    {/if}

    <form onsubmit={handleSubmit} class="space-y-3">
      <div class="space-y-2">
        <Label for="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autocomplete="email"
          required
          bind:value={email}
          disabled={loading}
        />
      </div>

      <Button type="submit" class="w-full" disabled={loading}>
        {loading ? 'Sending...' : 'Send reset link'}
      </Button>
    </form>

    <p class="text-muted-foreground mt-4 text-center text-sm">
      Remember your password?
      <a href="/sign-in" class="text-primary hover:text-primary/90 transition hover:underline"
        >Sign in</a
      >
    </p>
  </div>
</div>
