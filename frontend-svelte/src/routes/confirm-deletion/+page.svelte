<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { Button } from '$lib/components/ui/button';
  import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-svelte';

  type ConfirmationState = 'loading' | 'success' | 'error' | 'invalid_token' | 'already_processed';

  let state = $state<ConfirmationState>('loading');
  let scheduledDate = $state<string | null>(null);
  let errorMessage = $state('');

  $effect(() => {
    if (!browser) return;
    const token = $page.url.searchParams.get('token');
    if (!token) { state = 'invalid_token'; return; }

    fetch('/api/user/delete-account/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          if (data.error?.includes('already')) { state = 'already_processed'; }
          else { state = 'error'; errorMessage = data.error || 'Failed to confirm deletion'; }
          return;
        }
        state = 'success';
        scheduledDate = data.scheduledDeletionAt;
      })
      .catch(() => { state = 'error'; errorMessage = 'An unexpected error occurred.'; });
  });

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
</script>

<div class="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
  <div class="w-full max-w-md space-y-6">
    <div class="flex items-center gap-2">
      {#if state === 'loading'}
        <Loader2 class="h-5 w-5 animate-spin" />
        <h1 class="font-space text-3xl font-light tracking-tight">Confirming Deletion Request</h1>
      {:else if state === 'success'}
        <CheckCircle2 class="text-primary h-5 w-5" />
        <h1 class="font-space text-3xl font-light tracking-tight">Deletion Confirmed</h1>
      {:else}
        <XCircle class="text-destructive h-5 w-5" />
        <h1 class="font-space text-3xl font-light tracking-tight">Confirmation Failed</h1>
      {/if}
    </div>

    <div class="space-y-4">
      {#if state === 'loading'}
        <div class="flex justify-center py-4"><Loader2 class="text-muted-foreground h-8 w-8 animate-spin" /></div>
      {:else if state === 'success'}
        <div class="bg-destructive/10 border-destructive/50 rounded-lg border p-4">
          <div class="mb-2 flex items-center gap-2">
            <AlertTriangle class="text-destructive h-5 w-5" />
            <h3 class="font-semibold">30-Day Grace Period</h3>
          </div>
          <p class="text-sm">
            Your account is scheduled for deletion on
            {#if scheduledDate}<strong>{formatDate(scheduledDate)}</strong>{/if}.
            You can cancel this request at any time before that date.
          </p>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" onclick={() => goto('/settings/privacy')} class="flex-1">Go to Settings</Button>
          <Button onclick={() => goto('/dashboard')} class="flex-1">Go to Dashboard</Button>
        </div>
      {:else if state === 'invalid_token'}
        <p class="text-sm">The confirmation link you used is invalid or has expired.</p>
        <Button onclick={() => goto('/settings/privacy')}>Go to Settings</Button>
      {:else if state === 'already_processed'}
        <p class="text-sm">This deletion request has already been confirmed.</p>
        <Button onclick={() => goto('/settings/privacy')}>Go to Settings</Button>
      {:else}
        <div class="bg-destructive/10 rounded-lg p-4"><p class="text-sm">{errorMessage}</p></div>
        <div class="flex gap-2">
          <Button variant="outline" onclick={() => location.reload()}>Try Again</Button>
          <Button onclick={() => goto('/settings/privacy')}>Go to Settings</Button>
        </div>
      {/if}
    </div>
  </div>
</div>
