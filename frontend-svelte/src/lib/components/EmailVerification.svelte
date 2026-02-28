<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import * as Alert from '$lib/components/ui/alert';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Separator } from '$lib/components/ui/separator';
  import OtpInput from '$lib/components/OtpInput.svelte';
  import ResendButton from '$lib/components/ResendButton.svelte';
  import { toast } from 'svelte-sonner';
  import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Clock,
    Loader2,
    Mail
  } from '@lucide/svelte';

  let {
    email: emailProp = '',
    showOTPInput = true,
    callbackUrl: callbackUrlProp = '/dashboard',
    class: className
  }: {
    email?: string;
    showOTPInput?: boolean;
    callbackUrl?: string;
    class?: string;
  } = $props();

  let verificationStatus = $state<'unverified' | 'pending' | 'verified' | 'error'>('unverified');
  let error = $state<string | null>(null);
  let isVerifyingOTP = $state(false);
  let loading = $state(true);
  let success = $state(false);
  let alreadyVerified = $state(false);

  const searchParams = $derived($page.url.searchParams);
  const email = $derived(emailProp || searchParams.get('email') || $page.data.session?.user?.email || '');
  const callbackUrl = $derived(callbackUrlProp || searchParams.get('callbackUrl') || '/dashboard');
  const token = $derived(searchParams.get('token'));

  $effect(() => {
    const session = $page.data.session;
    if (!session?.user) {
      loading = false;
      return;
    }

    // Check if already verified
    if ((session.user as any)?.emailVerified) {
      alreadyVerified = true;
      loading = false;
      setTimeout(() => goto(callbackUrl), 2000);
      return;
    }

    // If token present, verify automatically
    if (token && email) {
      handleTokenVerification(token, email);
    } else {
      loading = false;
    }
  });

  async function handleTokenVerification(verificationToken: string, emailAddress: string) {
    loading = true;
    error = null;

    try {
      const response = await fetch('/api/auth/verify-email-nextauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken, email: emailAddress })
      });

      const result = await response.json();

      if (result.success) {
        success = true;
        verificationStatus = 'verified';
        toast.success('Your email address has been successfully verified.');
        setTimeout(() => goto(callbackUrl), 2000);
      } else {
        error = result.error || 'Verification failed';
        verificationStatus = 'error';
      }
    } catch (err) {
      console.error('Verification error:', err);
      error = 'Network error. Please try again.';
      verificationStatus = 'error';
    } finally {
      loading = false;
    }
  }

  async function handleOTPComplete(otp: string) {
    if (!email || otp.length < 6) return;

    isVerifyingOTP = true;
    error = null;

    try {
      const response = await fetch('/api/auth/verify-email-nextauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });

      const result = await response.json();

      if (result.success) {
        success = true;
        verificationStatus = 'verified';
        toast.success('Your email address has been successfully verified.');
        setTimeout(() => goto(callbackUrl), 1500);
      } else {
        error = result.error || 'Invalid verification code';
        verificationStatus = 'error';
      }
    } catch (err) {
      console.error('OTP verification error:', err);
      error = 'Network error. Please try again.';
      verificationStatus = 'error';
    } finally {
      isVerifyingOTP = false;
    }
  }

  function handleOTPChange(_otp: string) {
    if (error) error = null;
  }

  async function handleResendEmail() {
    error = null;
    verificationStatus = 'pending';
  }
</script>

{#if loading}
  <div class="flex min-h-screen items-center justify-center">
    <div class="flex items-center space-x-2">
      <Loader2 class="h-4 w-4 animate-spin" data-testid="loading-spinner" />
      <span>Checking verification status...</span>
    </div>
  </div>
{:else if alreadyVerified || success}
  <div class="flex min-h-screen items-center justify-center {className ?? ''}">
    <Card.Root class="w-full max-w-md" data-testid="verification-success-card">
      <Card.Content class="pt-6">
        <div class="space-y-4 text-center">
          <CheckCircle2 class="text-accent-foreground mx-auto h-16 w-16" />
          <div>
            <h3 class="text-accent-foreground text-lg font-semibold">
              {alreadyVerified ? 'Email Already Verified' : 'Email Verified!'}
            </h3>
            <p class="text-muted-foreground text-sm">Redirecting...</p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
{:else}
  <div
    data-testid="verification-container"
    class="bg-secondary flex min-h-screen items-center justify-center px-4 py-16 {className ?? ''}"
  >
    <Card.Root class="w-full max-w-md" data-testid="verification-card">
      <Card.Header class="text-center">
        <div
          class="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
        >
          <Mail class="text-muted-foreground h-6 w-6" />
        </div>
        <Card.Title class="text-2xl font-bold">Verify your email address</Card.Title>
        <Card.Description>
          We need to verify your email address before you can access the application.
        </Card.Description>
      </Card.Header>

      <Card.Content class="space-y-6">
        <!-- Verification Status -->
        {#if error}
          <Alert.Root variant="destructive" data-testid="verification-error">
            <AlertCircle class="h-4 w-4" />
            <Alert.Description>
              {error}
              {#if error.includes('Network error')}
                <Button
                  variant="link"
                  size="sm"
                  onclick={() => { error = null; }}
                  class="text-destructive hover:text-destructive/80 ml-2 h-auto p-0"
                >
                  Retry
                </Button>
              {/if}
            </Alert.Description>
          </Alert.Root>
        {:else if verificationStatus === 'pending'}
          <Alert.Root class="border-muted bg-muted/50" data-testid="verification-pending">
            <Clock class="text-muted-foreground h-4 w-4" />
            <Alert.Description class="text-muted-foreground">
              Verification in progress for <strong>{email}</strong>...
            </Alert.Description>
          </Alert.Root>
        {:else}
          <div class="space-y-3" data-testid="verification-info">
            <div class="flex items-center gap-2">
              <Mail class="text-muted-foreground h-4 w-4" />
              <span class="text-foreground text-sm">
                Verification email sent to <strong>{email}</strong>
              </span>
              <Badge variant="outline" class="text-xs">Unverified</Badge>
            </div>
          </div>
        {/if}

        <!-- OTP Input Section -->
        {#if showOTPInput}
          <Separator />
          <div class="space-y-4">
            <div class="text-center">
              <p class="text-muted-foreground text-sm">
                Enter the 8-digit code sent to <span class="font-medium">{email}</span>
              </p>
            </div>

            <OtpInput
              onComplete={handleOTPComplete}
              onChange={handleOTPChange}
              disabled={isVerifyingOTP}
            />

            {#if isVerifyingOTP}
              <div class="text-muted-foreground flex items-center justify-center space-x-2 text-sm">
                <Loader2 class="h-4 w-4 animate-spin" data-testid="loading-spinner" />
                <span>Verifying...</span>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Action Buttons -->
        <div class="space-y-4">
          <ResendButton
            {email}
            onResend={handleResendEmail}
            disabled={verificationStatus === 'pending'}
          />

          <div class="text-center">
            <p class="text-muted-foreground mb-3 text-xs">
              Didn't receive the email? Check your spam folder.
            </p>
          </div>
        </div>

        <!-- Navigation -->
        <div class="space-y-3 border-t pt-4">
          <Button onclick={() => goto(callbackUrl)} class="w-full" variant="default">
            Continue
          </Button>

          <Button
            onclick={() => goto('/sign-in')}
            variant="ghost"
            class="text-muted-foreground w-full"
          >
            <ArrowLeft class="mr-2 h-4 w-4" />
            Back to sign in
          </Button>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
{/if}
