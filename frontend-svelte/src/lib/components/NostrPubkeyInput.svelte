<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { toast } from 'svelte-sonner';
  import { CheckCircle, Copy, Loader2 } from '@lucide/svelte';
  import { isValidNpub, npubToHex } from '$lib/nostr/keypair';

  let {
    value = $bindable(''),
    recipientId,
    secretId,
    onSave
  }: {
    value: string;
    recipientId?: string;
    secretId?: string;
    onSave?: (npub: string) => void;
  } = $props();

  let saving = $state(false);

  let valid = $derived(value.length > 0 && isValidNpub(value));
  let hexPubkey = $derived.by(() => {
    try {
      return valid ? npubToHex(value) : null;
    } catch {
      return null;
    }
  });

  let canSave = $derived(valid && !!recipientId && !!secretId);

  async function handleSave() {
    if (!canSave) return;
    saving = true;

    try {
      const csrfRes = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfRes.json();

      const response = await fetch(
        `/api/secrets/${secretId}/recipients/${recipientId}/nostr-pubkey`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
          },
          body: JSON.stringify({ npub: value })
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save Nostr pubkey');
      }

      toast.success('Nostr pubkey saved');
      onSave?.(value);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message, { description: 'Failed to save pubkey' });
    } finally {
      saving = false;
    }
  }

  function copyHex() {
    if (hexPubkey) {
      navigator.clipboard.writeText(hexPubkey);
      toast.success('Hex pubkey copied');
    }
  }
</script>

<div class="space-y-2">
  <Label for="npub-input">Recipient Nostr Public Key</Label>
  <div class="flex gap-2">
    <div class="relative flex-1">
      <Input
        id="npub-input"
        bind:value
        placeholder="npub1..."
        disabled={saving}
        class={valid ? 'border-primary pr-8' : value.length > 0 ? 'border-destructive' : ''}
      />
      {#if valid}
        <CheckCircle
          class="absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-primary"
        />
      {/if}
    </div>
    {#if canSave}
      <Button onclick={handleSave} disabled={saving} size="sm">
        {#if saving}
          <Loader2 class="h-4 w-4 animate-spin" />
        {:else}
          Save
        {/if}
      </Button>
    {/if}
  </div>

  {#if valid && hexPubkey}
    <button
      type="button"
      onclick={copyHex}
      class="text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono text-xs transition-colors"
      aria-label="Copy hex pubkey"
    >
      <Copy class="h-3 w-3" />
      {hexPubkey}
    </button>
  {:else if value.length > 0 && !valid}
    <p class="text-destructive text-xs">Invalid npub format. Must start with "npub1".</p>
  {/if}
</div>
