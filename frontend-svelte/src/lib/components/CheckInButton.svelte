<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { toast } from 'svelte-sonner';
  import { CheckCircle, Loader2 } from '@lucide/svelte';
  import type { Secret } from '$lib/types/secret-types';

  let {
    secretId,
    onCheckInSuccess,
    variant = 'outline'
  }: {
    secretId: string;
    onCheckInSuccess?: (secret: Secret) => void;
    variant?: 'default' | 'outline' | 'ghost';
  } = $props();

  let loading = $state(false);

  async function handleCheckIn() {
    loading = true;

    try {
      const response = await fetch(`/api/secrets/${secretId}/check-in`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
      }

      const res = await response.json();
      onCheckInSuccess?.(res.secret);
    } catch (err) {
      console.error('Error checking in:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error(errorMessage, { description: 'Check-in failed' });
    } finally {
      loading = false;
    }
  }
</script>

<Button onclick={handleCheckIn} disabled={loading} {variant} size="sm" class="">
  {#if loading}
    <Loader2 class="h-4 w-4 animate-spin" />
    Checking in...
  {:else}
    <CheckCircle class="h-4 w-4" />
    Check In
  {/if}
</Button>
