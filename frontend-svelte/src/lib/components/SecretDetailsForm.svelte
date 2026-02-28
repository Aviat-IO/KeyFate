<script lang="ts">
  import { goto } from '$app/navigation';
  import * as Alert from '$lib/components/ui/alert';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Separator } from '$lib/components/ui/separator';
  import { Textarea } from '$lib/components/ui/textarea';
  import { toast } from 'svelte-sonner';
  import {
    AlertCircle,
    AlertTriangle,
    Calendar,
    Clock,
    Eye,
    Mail,
    Phone,
    Shield,
    Trash2,
    User
  } from '@lucide/svelte';
  import { format } from 'timeago.js';

  interface SecretRecipient {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  }

  interface SecretData {
    id: string;
    title: string;
    recipients: SecretRecipient[];
    check_in_days: number;
    last_check_in: string | null;
    next_check_in: string | null;
    status: 'active' | 'paused' | 'triggered';
    sss_shares_total: number;
    sss_threshold: number;
    server_share: string | null;
    created_at: string;
    updated_at: string;
  }

  let { secret }: { secret: SecretData } = $props();

  let loading = $state(false);
  let error = $state<string | null>(null);
  let serverShare = $state<string | null>(null);
  let showDeleteDialog = $state(false);
  let showRevealDialog = $state(false);
  let serverShareDeleted = $state(!secret.server_share);

  async function handleRevealServerShare() {
    loading = true;
    error = null;

    try {
      const csrfRes = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfRes.json();

      const response = await fetch(`/api/secrets/${secret.id}/reveal-server-share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reveal server share');
      }

      const { serverShare: share } = await response.json();
      serverShare = share;
      showRevealDialog = false;
    } catch (err) {
      console.error('Error revealing server share:', err);
      error = err instanceof Error ? err.message : 'Failed to reveal server share';
    } finally {
      loading = false;
    }
  }

  async function handleDeleteServerShare() {
    loading = true;
    error = null;

    try {
      const csrfRes = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfRes.json();

      const response = await fetch(`/api/secrets/${secret.id}/delete-server-share`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete server share');
      }

      serverShareDeleted = true;
      showDeleteDialog = false;
    } catch (err) {
      console.error('Error deleting server share:', err);
      error = err instanceof Error ? err.message : 'Failed to delete server share';
    } finally {
      loading = false;
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }
</script>

<div class="space-y-6">
  {#if error}
    <Alert.Root variant="destructive">
      <AlertCircle class="h-4 w-4" />
      <Alert.Description>{error}</Alert.Description>
    </Alert.Root>
  {/if}

  {#if serverShareDeleted}
    <Alert.Root variant="destructive">
      <AlertTriangle class="h-4 w-4" />
      <Alert.Description>
        <strong>Secret Disabled:</strong> The server share has been deleted and this secret has been
        automatically paused. No reminder emails will be sent.
      </Alert.Description>
    </Alert.Root>
  {/if}

  <Card.Root>
    <Card.Header>
      <div class="flex items-center justify-between">
        <Card.Title class="text-xl">{secret.title}</Card.Title>
        <Badge variant={secret.status === 'active' ? 'default' : 'secondary'}>
          {secret.status}
        </Badge>
      </div>
    </Card.Header>
    <Card.Content class="space-y-6">
      <!-- SSS Info -->
      <div class="bg-muted/50 rounded-lg p-4">
        <h3 class="mb-3 flex items-center font-medium">
          <Shield class="mr-2 h-4 w-4" />
          Secret Configuration
        </h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-muted-foreground">Total Shares:</span>
            <span class="ml-2 font-medium">{secret.sss_shares_total}</span>
          </div>
          <div>
            <span class="text-muted-foreground">Threshold:</span>
            <span class="ml-2 font-medium">{secret.sss_threshold}</span>
          </div>
        </div>
        <p class="text-muted-foreground mt-2 text-xs">
          Your secret was split into {secret.sss_shares_total} shares. Any {secret.sss_threshold} shares
          can reconstruct the original secret.
        </p>
      </div>

      <Separator />

      <!-- Recipients -->
      <div>
        <h3 class="mb-3 flex items-center font-medium">
          <User class="mr-2 h-4 w-4" />
          Recipients ({secret.recipients.length})
        </h3>
        <div class="space-y-4">
          {#each secret.recipients as recipient}
            <div class="rounded-lg border p-3 text-sm">
              <div class="mb-2 flex items-center">
                <User class="text-muted-foreground mr-2 h-4 w-4" />
                <span class="font-medium">{recipient.name}</span>
              </div>
              <div class="space-y-1 pl-6">
                {#if recipient.email}
                  <div class="flex items-center">
                    <Mail class="text-muted-foreground mr-2 h-3 w-3" />
                    <span class="text-xs">{recipient.email}</span>
                  </div>
                {/if}
                {#if recipient.phone}
                  <div class="flex items-center">
                    <Phone class="text-muted-foreground mr-2 h-3 w-3" />
                    <span class="text-xs">{recipient.phone}</span>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <Separator />

      <!-- Check-in Info -->
      <div>
        <h3 class="mb-3 flex items-center font-medium">
          <Clock class="mr-2 h-4 w-4" />
          Check-in Schedule
        </h3>
        <div class="space-y-2 text-sm">
          <div>
            <span class="text-muted-foreground">Frequency:</span>
            <span class="ml-2 font-medium">Every {secret.check_in_days} days</span>
          </div>
          {#if secret.last_check_in}
            <div>
              <span class="text-muted-foreground">Last check-in:</span>
              <span class="ml-2">{format(secret.last_check_in)}</span>
            </div>
          {/if}
          {#if secret.next_check_in}
            <div>
              <span class="text-muted-foreground">Next check-in due:</span>
              <span class="ml-2">{format(secret.next_check_in)}</span>
            </div>
          {/if}
        </div>
      </div>

      <Separator />

      <!-- Server Share Management -->
      <div>
        <h3 class="mb-3 flex items-center font-medium">
          <Shield class="mr-2 h-4 w-4" />
          Server Share Management
        </h3>

        {#if !serverShareDeleted}
          <div class="space-y-4">
            <p class="text-muted-foreground text-sm">
              The server holds one of your {secret.sss_shares_total} shares.
            </p>
            <div class="flex flex-col gap-2 sm:flex-row">
              <Dialog.Root bind:open={showRevealDialog}>
                <Dialog.Trigger>
                  {#snippet child({ props })}
                    <Button variant="outline" class="flex-1" {...props}>
                      <Eye class="mr-2 h-4 w-4" />
                      Reveal Server Share
                    </Button>
                  {/snippet}
                </Dialog.Trigger>
                <Dialog.Content>
                  <Dialog.Header>
                    <Dialog.Title>Reveal Server Share</Dialog.Title>
                    <Dialog.Description>
                      This will decrypt and show you the server's share.
                    </Dialog.Description>
                  </Dialog.Header>
                  <Alert.Root variant="destructive">
                    <AlertTriangle class="h-4 w-4" />
                    <Alert.Description>
                      <strong>Warning:</strong> Once revealed, this share can be combined with
                      {secret.sss_threshold - 1} other share(s) to reconstruct your secret.
                    </Alert.Description>
                  </Alert.Root>
                  <Dialog.Footer>
                    <Button variant="outline" onclick={() => (showRevealDialog = false)}>
                      Cancel
                    </Button>
                    <Button onclick={handleRevealServerShare} disabled={loading}>
                      {loading ? 'Revealing...' : 'Yes, Reveal Share'}
                    </Button>
                  </Dialog.Footer>
                </Dialog.Content>
              </Dialog.Root>

              <Dialog.Root bind:open={showDeleteDialog}>
                <Dialog.Trigger>
                  {#snippet child({ props })}
                    <Button variant="destructive" class="flex-1" {...props}>
                      <Trash2 class="mr-2 h-4 w-4" />
                      Delete Server Share
                    </Button>
                  {/snippet}
                </Dialog.Trigger>
                <Dialog.Content>
                  <Dialog.Header>
                    <Dialog.Title>Delete Server Share</Dialog.Title>
                    <Dialog.Description>
                      This will permanently delete the server's share.
                    </Dialog.Description>
                  </Dialog.Header>
                  <Alert.Root variant="destructive">
                    <AlertTriangle class="h-4 w-4" />
                    <Alert.Description>
                      <strong>Warning:</strong> After deletion, the server will no longer be able to
                      provide its share to recipients.
                    </Alert.Description>
                  </Alert.Root>
                  <Dialog.Footer>
                    <Button variant="outline" onclick={() => (showDeleteDialog = false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onclick={handleDeleteServerShare} disabled={loading}>
                      {loading ? 'Deleting...' : 'Yes, Delete Share'}
                    </Button>
                  </Dialog.Footer>
                </Dialog.Content>
              </Dialog.Root>
            </div>
          </div>
        {:else}
          <Alert.Root>
            <AlertTriangle class="h-4 w-4" />
            <Alert.Description>
              Server share has been deleted. The server can no longer provide its share.
            </Alert.Description>
          </Alert.Root>
        {/if}
      </div>

      <!-- Revealed Server Share -->
      {#if serverShare}
        <div>
          <h3 class="text-destructive mb-3 flex items-center font-medium">
            <Eye class="mr-2 h-4 w-4" />
            Revealed Server Share
          </h3>
          <div class="space-y-2">
            <Textarea value={serverShare} readonly class="font-mono text-xs" rows={3} />
            <Button variant="outline" size="sm" onclick={() => copyToClipboard(serverShare!)}>
              Copy Share
            </Button>
          </div>
        </div>
      {/if}

      <Separator />

      <div class="text-muted-foreground text-xs">
        <div class="flex items-center">
          <Calendar class="mr-2 h-3 w-3" />
          Created {format(secret.created_at)}
        </div>
      </div>
    </Card.Content>
  </Card.Root>

  <div class="flex justify-end space-x-4">
    <Button variant="outline" onclick={() => goto('/dashboard')}>Back to Dashboard</Button>
  </div>
</div>
