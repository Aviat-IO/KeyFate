<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Loader2, Pause, Play } from '@lucide/svelte';
  import type { Secret } from '$lib/types/secret-types';

  let {
    secretId,
    status,
    onToggleSuccess
  }: {
    secretId: string;
    status: Secret['status'];
    onToggleSuccess: (updatedSecret: Secret) => void;
  } = $props();

  let isLoading = $state(false);

  async function handleTogglePause() {
    try {
      isLoading = true;

      const csrfRes = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfRes.json();

      const response = await fetch(`/api/secrets/${secretId}/toggle-pause`, {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken
        }
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      onToggleSuccess(data.secret);
    } catch (err) {
      console.error('Error toggling pause:', err);
    } finally {
      isLoading = false;
    }
  }
</script>

<Button variant="ghost" size="sm" onclick={handleTogglePause} disabled={isLoading} class="uppercase tracking-wide">
  {#if isLoading}
    <Loader2 class="h-4 w-4 animate-spin" />
    {status === 'active' ? 'Pause' : 'Resume'}
  {:else if status === 'active'}
    <Pause class="h-4 w-4" />
    Pause
  {:else}
    <Play class="h-4 w-4" />
    Resume
  {/if}
</Button>
