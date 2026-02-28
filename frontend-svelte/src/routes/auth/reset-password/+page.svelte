<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { AlertCircle, CheckCircle2 } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Alert from '$lib/components/ui/alert';

  let password = $state('');
  let confirmPassword = $state('');
  let loading = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);
  let validationErrors = $state<string[]>([]);

  const token = $derived($page.url.searchParams.get('token'));

  function validatePasswordClient(pwd: string): string[] {
    const errors: string[] = [];
    if (pwd.length < 10) errors.push('At least 10 characters long');
    if (!/(?=.*[a-z])/.test(pwd)) errors.push('One lowercase letter');
    if (!/(?=.*[A-Z])/.test(pwd)) errors.push('One uppercase letter');
    if (!/(?=.*\d)/.test(pwd)) errors.push('One number');
    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(pwd))
      errors.push('One special character (!@#$%^&*)');
    return errors;
  }

  function handlePasswordChange(value: string) {
    password = value;
    validationErrors = value ? validatePasswordClient(value) : [];
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    error = null;

    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      loading = false;
      return;
    }

    const clientErrors = validatePasswordClient(password);
    if (clientErrors.length > 0) {
      error = 'Password does not meet requirements';
      loading = false;
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await res.json();

      if (res.ok) {
        success = true;
        setTimeout(() => {
          goto('/sign-in');
        }, 3000);
      } else {
        error = data.error || 'Failed to reset password';
      }
    } catch (err) {
      console.error('Password reset error:', err);
      error = 'An unexpected error occurred. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Reset Password - KeyFate</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center px-4">
  <div class="w-full max-w-md space-y-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold">Reset your password</h1>
      <p class="text-muted-foreground mt-1 text-sm">
        {#if !token}
          Invalid password reset link
        {:else}
          Enter your new password below.
        {/if}
      </p>
    </div>

    {#if !token}
      <Alert.Root variant="destructive">
        <AlertCircle class="h-4 w-4" />
        <Alert.Description>
          This password reset link is invalid or has expired. Please request a new one.
        </Alert.Description>
      </Alert.Root>
      <div class="text-center">
        <a
          href="/auth/forgot-password"
          class="text-primary hover:text-primary/90 transition hover:underline"
        >
          Request a new reset link
        </a>
      </div>
    {:else}
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
            Password reset successfully! Redirecting to sign in...
          </Alert.Description>
        </Alert.Root>
      {/if}

      <form onsubmit={handleSubmit} class="space-y-3">
        <div class="space-y-2">
          <Label for="password">New Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autocomplete="new-password"
            required
            minlength={10}
            value={password}
            oninput={(e) => handlePasswordChange((e.target as HTMLInputElement).value)}
            disabled={loading || success}
          />
          {#if password && validationErrors.length > 0}
            <div class="text-muted-foreground text-sm">
              <p class="font-medium">Password must include:</p>
              <ul class="list-inside list-disc space-y-1">
                {#each validationErrors as err}
                  <li class="text-destructive">{err}</li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if password && validationErrors.length === 0}
            <p class="text-accent-foreground text-sm">Password meets all requirements</p>
          {/if}
        </div>

        <div class="space-y-2">
          <Label for="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autocomplete="new-password"
            required
            minlength={10}
            bind:value={confirmPassword}
            disabled={loading || success}
          />
        </div>

        <Button
          type="submit"
          class="w-full"
          disabled={loading || success || validationErrors.length > 0}
        >
          {loading ? 'Resetting...' : 'Reset password'}
        </Button>
      </form>
    {/if}

    <div class="text-center">
      <a href="/sign-in" class="text-primary hover:text-primary/90 text-sm transition hover:underline"
        >Back to sign in</a
      >
    </div>
  </div>
</div>
