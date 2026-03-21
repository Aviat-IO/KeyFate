<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { toast } from 'svelte-sonner';
  import { Loader2, RotateCcw } from '@lucide/svelte';

  let {
    email,
    onResend,
    disabled = false,
    class: className,
    cooldownSeconds = 60
  }: {
    email: string;
    onResend?: () => Promise<void>;
    disabled?: boolean;
    class?: string;
    cooldownSeconds?: number;
  } = $props();

  let isResending = $state(false);
  let cooldownTime = $state(0);

  $effect(() => {
    if (cooldownTime > 0) {
      const interval = setInterval(() => {
        cooldownTime = cooldownTime <= 1 ? 0 : cooldownTime - 1;
      }, 1000);

      return () => clearInterval(interval);
    }
  });

  async function handleResend() {
    if (!email || cooldownTime > 0 || isResending || disabled) return;

    isResending = true;

    try {
      if (onResend) {
        await onResend();
      } else {
        const response = await fetch('/api/auth/resend-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        const result = await response.json();

        if (result.success) {
          toast.success('A new verification email has been sent to your email address.');
          cooldownTime = cooldownSeconds;
        } else {
          throw new Error(result.error || 'Failed to resend verification email');
        }
      }
    } catch (err) {
      console.error('Resend error:', err);
      toast.error(
        err instanceof Error ? err.message : 'Failed to resend verification email. Please try again.'
      );
    } finally {
      isResending = false;
    }
  }

  let isButtonDisabled = $derived(disabled || isResending || cooldownTime > 0);
</script>

<Button
  onclick={handleResend}
  disabled={isButtonDisabled}
  variant="outline"
  class={`w-full ${className ?? ''}`}
  data-testid="resend-verification-button"
>
  {#if isResending}
    <Loader2 class="mr-2 h-4 w-4 animate-spin" />
    Sending...
  {:else if cooldownTime > 0}
    <RotateCcw class="mr-2 h-4 w-4" />
    Resend in {cooldownTime}s
  {:else}
    <RotateCcw class="mr-2 h-4 w-4" />
    Resend verification email
  {/if}
</Button>
