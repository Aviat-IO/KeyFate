<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { AlertCircle, Download, Loader2, ShieldCheck } from '@lucide/svelte';
  import { DEFAULT_RELAYS } from '$lib/nostr/relay-config';

  let {
    secret,
    threshold,
    totalShares,
    class: className
  }: {
    secret: {
      id: string;
      title: string;
      checkInDays: number;
      createdAt: Date | string;
      recipients: Array<{
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
      }>;
    };
    threshold: number;
    totalShares: number;
    class?: string;
  } = $props();

  let isOpen = $state(false);
  let isExporting = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);

  async function handleExport() {
    isExporting = true;
    error = null;
    success = false;

    try {
      // Get CSRF token
      const csrfRes = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfRes.json();

      const response = await fetch(`/api/secrets/${secret.id}/export-share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) throw new Error('Session expired. Please log in again.');
        if (response.status === 404) throw new Error('Server share not found or has been deleted.');
        throw new Error(errorData.error || 'Failed to retrieve server share');
      }

      const shareData = await response.json();
      const serverShare = shareData.serverShare;

      // Get user-managed shares from localStorage
      const storedData = localStorage.getItem(`keyfate:userManagedShares:${secret.id}`);
      let userManagedShares: string[] = [];
      if (storedData) {
        try {
          const parsed = JSON.parse(storedData);
          if (parsed.expiresAt > Date.now()) {
            userManagedShares = parsed.shares || [];
          }
        } catch {
          // ignore parse errors
        }
      }

      // Fetch Bitcoin status (non-blocking — include if available)
      let bitcoinData: Record<string, unknown> | undefined;
      try {
        const btcRes = await fetch(`/api/secrets/${secret.id}/bitcoin-status`);
        if (btcRes.ok) {
          const btcStatus = await btcRes.json();
          if (btcStatus.enabled && btcStatus.utxo) {
            bitcoinData = {
              enabled: true,
              preSignedRecipientTx: btcStatus.utxo.preSignedRecipientTx ?? null,
              timelockBlocks: btcStatus.utxo.ttlBlocks,
              timelockDays: Math.round(btcStatus.utxo.ttlBlocks / 144),
              utxoTxId: btcStatus.utxo.txId,
              utxoOutputIndex: btcStatus.utxo.outputIndex,
              amountSats: btcStatus.utxo.amountSats
            };
          }
        }
      } catch {
        // Bitcoin data is optional — continue without it
      }

      // Nostr data: include relay list and passphrase bundle if stored locally
      let nostrData: Record<string, unknown> | undefined;
      const nostrStoredData = localStorage.getItem(`keyfate:nostrData:${secret.id}`);
      if (nostrStoredData) {
        try {
          const parsed = JSON.parse(nostrStoredData);
          nostrData = {
            enabled: true,
            eventIds: parsed.eventIds ?? [],
            relays: [...DEFAULT_RELAYS],
            encryptedKPassphrase: parsed.encryptedKPassphrase ?? null
          };
        } catch {
          // Nostr data is optional
        }
      }
      if (!nostrData) {
        // Include relay list even without stored event IDs
        nostrData = {
          enabled: false,
          eventIds: [],
          relays: [...DEFAULT_RELAYS],
          encryptedKPassphrase: null
        };
      }

      // Build and download recovery kit
      const kitData: Record<string, unknown> = {
        metadata: {
          id: secret.id,
          title: secret.title,
          threshold,
          totalShares,
          checkInDays: secret.checkInDays,
          recipients: secret.recipients.map((r) => ({ name: r.name, email: r.email || '' })),
          createdAt:
            typeof secret.createdAt === 'string'
              ? secret.createdAt
              : secret.createdAt.toISOString(),
          exportedAt: new Date().toISOString()
        },
        serverShare,
        userManagedShares,
        ...(bitcoinData ? { bitcoin: bitcoinData } : {}),
        nostr: nostrData,
        recoveryInstructions:
          'Visit https://keyfate.com/recover to use this recovery kit. ' +
          'If KeyFate is unreachable, use the Bitcoin pre-signed transaction or ' +
          'the passphrase to recover the symmetric key K, then decrypt each share ' +
          'with ChaCha20-Poly1305 and combine using Shamir Secret Sharing.'
      };

      const blob = new Blob([JSON.stringify(kitData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `keyfate-recovery-kit-${secret.title.replace(/\s+/g, '-').toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      success = true;
      setTimeout(() => {
        isOpen = false;
        success = false;
      }, 2000);
    } catch (err) {
      console.error('Export error:', err);
      error = err instanceof Error ? err.message : 'Failed to export recovery kit';
    } finally {
      isExporting = false;
    }
  }
</script>

<Dialog.Root bind:open={isOpen}>
  <Dialog.Trigger>
    {#snippet child({ props })}
      <Button variant="outline" class="{className}" {...props}>
        <Download class="mr-2 h-4 w-4" />
        Export Recovery Kit
      </Button>
    {/snippet}
  </Dialog.Trigger>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="font-space flex items-center gap-2">
        <ShieldCheck class="text-primary h-5 w-5" />
        Export Recovery Kit
      </Dialog.Title>
      <Dialog.Description>
        Download a complete backup of your secret that works without KeyFate.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <div class="bg-muted/50 rounded-lg p-4">
        <h4 class="font-space mb-2 font-medium">This kit includes:</h4>
        <ul class="text-muted-foreground space-y-1 text-sm">
          <li>&bull; Standalone recovery tool (works offline)</li>
          <li>&bull; Server share (decrypted)</li>
          <li>&bull; Your user-managed shares (if available)</li>
          <li>&bull; Bitcoin transaction data and timelock info (if enabled)</li>
          <li>&bull; Nostr relay list and encrypted key bundle</li>
          <li>&bull; Secret metadata and recovery instructions</li>
        </ul>
      </div>

      <div class="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div class="flex gap-2">
          <AlertCircle class="h-5 w-5 shrink-0 text-destructive" />
          <div>
            <h4 class="font-medium text-foreground">Security Notice</h4>
            <p class="text-sm text-muted-foreground">
              Store this file securely. Anyone with this kit and enough shares can reconstruct your
              secret.
            </p>
          </div>
        </div>
      </div>

      {#if error}
        <div class="border-destructive/50 bg-destructive/10 rounded-lg border p-4">
          <p class="text-destructive text-sm">{error}</p>
        </div>
      {/if}

      {#if success}
        <div class="rounded-lg border border-primary/50 bg-primary/10 p-4">
          <p class="text-sm text-primary">
            Recovery kit downloaded successfully!
          </p>
        </div>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="ghost" onclick={() => (isOpen = false)} disabled={isExporting} class="">
        Cancel
      </Button>
      <Button onclick={handleExport} disabled={isExporting} class="">
        {#if isExporting}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
          Exporting...
        {:else}
          <Download class="mr-2 h-4 w-4" />
          Download Kit
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
