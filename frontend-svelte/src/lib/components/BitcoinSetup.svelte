<script lang="ts">
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Card from '$lib/components/ui/card';
  import * as Select from '$lib/components/ui/select';
  import { Separator } from '$lib/components/ui/separator';
  import { toast } from 'svelte-sonner';
  import { AlertTriangle, Bitcoin, Check, Copy, Loader2, Wallet } from '@lucide/svelte';
  import { hex } from '@scure/base';
  import * as btc from '@scure/btc-signer';
  import {
    generateBitcoinKeypair,
    storeKeypair,
    getStoredKeypair,
    storeBitcoinMeta,
    type BitcoinKeypair
  } from '$lib/bitcoin/client-wallet';
  import { enableBitcoinClient } from '$lib/bitcoin/client-operations';
  import { daysToBlocks } from '$lib/bitcoin/script';

  let {
    secretId,
    checkInDays = 30,
    onSetupComplete
  }: {
    secretId: string;
    checkInDays?: number;
    onSetupComplete?: () => void;
  } = $props();

  // --- State machine ---
  type Step = 'configure' | 'fund' | 'confirm' | 'processing' | 'done';
  let step = $state<Step>('configure');

  // --- Configuration ---
  let amountSats = $state(50_000);
  let feePriority = $state<string>('medium');
  let network = $state<'mainnet' | 'testnet'>('testnet');

  // --- Keypairs ---
  let ownerKeypair = $state<BitcoinKeypair | null>(null);
  let recipientKeypair = $state<BitcoinKeypair | null>(null);

  // --- Funding info ---
  let fundingAddress = $state('');
  let fundingTxId = $state('');
  let fundingOutputIndex = $state(0);
  let addressCopied = $state(false);

  // --- Processing ---
  let loading = $state(false);
  let errorMessage = $state<string | null>(null);

  // --- Placeholder values for enableBitcoinClient params we don't have yet ---
  // These are needed for the OP_RETURN payload. In a full implementation,
  // these would come from the secret's Nostr integration.
  const PLACEHOLDER_SYMMETRIC_KEY = new Uint8Array(32); // zeroed — placeholder
  const PLACEHOLDER_NOSTR_EVENT_ID = '0'.repeat(64); // placeholder

  const feeEstimates: Record<string, { label: string; rate: number }> = {
    low: { label: 'Low (~60 min)', rate: 5 },
    medium: { label: 'Medium (~30 min)', rate: 15 },
    high: { label: 'High (~10 min)', rate: 30 }
  };

  let isAmountValid = $derived(amountSats >= 10_000 && amountSats <= 10_000_000);
  let feeRate = $derived(feeEstimates[feePriority]?.rate ?? 15);
  let estimatedFee = $derived(feeRate * 153); // ~153 vbytes for timelock creation
  let totalRequired = $derived(amountSats + estimatedFee);
  let ttlBlocks = $derived(daysToBlocks(checkInDays));

  let isFundingTxIdValid = $derived(/^[0-9a-f]{64}$/i.test(fundingTxId.trim()));
  let isFundingOutputIndexValid = $derived(
    Number.isInteger(fundingOutputIndex) && fundingOutputIndex >= 0
  );

  function getP2WPKHAddress(pubkey: Uint8Array, net: 'mainnet' | 'testnet'): string {
    const networkObj = net === 'testnet' ? btc.TEST_NETWORK : btc.NETWORK;
    const p2wpkh = btc.p2wpkh(pubkey, networkObj);
    if (!p2wpkh.address) throw new Error('Failed to derive P2WPKH address');
    return p2wpkh.address;
  }

  function handleGenerateKeys() {
    errorMessage = null;
    try {
      // Check for existing keypairs in session storage
      const existingOwner = getStoredKeypair(secretId, 'owner');
      const existingRecipient = getStoredKeypair(secretId, 'recipient');

      if (existingOwner && existingRecipient) {
        ownerKeypair = existingOwner;
        recipientKeypair = existingRecipient;
      } else {
        ownerKeypair = generateBitcoinKeypair();
        recipientKeypair = generateBitcoinKeypair();
        storeKeypair(secretId, 'owner', ownerKeypair);
        storeKeypair(secretId, 'recipient', recipientKeypair);
      }

      fundingAddress = getP2WPKHAddress(ownerKeypair.pubkey, network);
      step = 'fund';
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to generate keys';
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(fundingAddress);
      addressCopied = true;
      setTimeout(() => (addressCopied = false), 2000);
    } catch {
      toast.error('Failed to copy address');
    }
  }

  function handleFundingConfirmed() {
    errorMessage = null;
    if (!isFundingTxIdValid) {
      errorMessage = 'Please enter a valid 64-character hex transaction ID.';
      return;
    }
    if (!isFundingOutputIndexValid) {
      errorMessage = 'Output index must be a non-negative integer.';
      return;
    }
    step = 'confirm';
  }

  async function handleEnableBitcoin() {
    if (!ownerKeypair || !recipientKeypair) {
      errorMessage = 'Keypairs not found. Please start over.';
      step = 'configure';
      return;
    }

    loading = true;
    errorMessage = null;
    step = 'processing';

    try {
      // Derive the scriptPubKey for the funding UTXO (owner's P2WPKH)
      const networkObj = network === 'testnet' ? btc.TEST_NETWORK : btc.NETWORK;
      const p2wpkh = btc.p2wpkh(ownerKeypair.pubkey, networkObj);
      const scriptPubKey = hex.encode(p2wpkh.script);

      // Derive a recipient address (P2WPKH from recipient pubkey)
      const recipientAddress = getP2WPKHAddress(recipientKeypair.pubkey, network);

      // Call client-side Bitcoin operations
      const result = await enableBitcoinClient({
        ownerKeypair,
        recipientKeypair,
        fundingUtxo: {
          txId: fundingTxId.trim(),
          outputIndex: fundingOutputIndex,
          amountSats: totalRequired,
          scriptPubKey
        },
        amountSats,
        feeRateSatsPerVbyte: feeRate,
        symmetricKeyK: PLACEHOLDER_SYMMETRIC_KEY,
        nostrEventId: PLACEHOLDER_NOSTR_EVENT_ID,
        recipientAddress,
        ttlBlocks,
        network
      });

      // Store results on server
      const csrfRes = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfRes.json();

      const storeResponse = await fetch(`/api/secrets/${secretId}/store-bitcoin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
          txId: result.txId,
          outputIndex: result.outputIndex,
          timelockScript: hex.encode(result.timelockScript),
          preSignedRecipientTx: result.preSignedRecipientTx,
          ownerPubkey: hex.encode(result.ownerPubkey),
          recipientPubkey: hex.encode(result.recipientPubkey),
          amountSats,
          ttlBlocks,
          network
        })
      });

      if (!storeResponse.ok) {
        const data = await storeResponse.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to store Bitcoin data on server');
      }

      // Store metadata needed for future refresh operations
      storeBitcoinMeta(secretId, {
        symmetricKeyK: hex.encode(PLACEHOLDER_SYMMETRIC_KEY),
        nostrEventId: PLACEHOLDER_NOSTR_EVENT_ID,
        recipientAddress,
      });

      step = 'done';
      toast.success('Bitcoin timelock enabled successfully');
      onSetupComplete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errorMessage = message;
      step = 'confirm'; // Allow retry
      toast.error(message, { description: 'Bitcoin setup failed' });
    } finally {
      loading = false;
    }
  }

  function handleStartOver() {
    step = 'configure';
    ownerKeypair = null;
    recipientKeypair = null;
    fundingAddress = '';
    fundingTxId = '';
    fundingOutputIndex = 0;
    errorMessage = null;
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <Bitcoin class="h-5 w-5" />
      Bitcoin Timelock Setup
    </Card.Title>
    <Card.Description>
      Lock BTC in a timelock transaction. If you stop checking in, the funds become spendable by
      your recipient after the CSV delay expires ({ttlBlocks} blocks ≈ {checkInDays} days).
    </Card.Description>
  </Card.Header>

  <Card.Content class="space-y-4">
    {#if errorMessage}
      <Alert.Root variant="destructive">
        <AlertTriangle class="h-4 w-4" />
        <Alert.Description class="text-xs">{errorMessage}</Alert.Description>
      </Alert.Root>
    {/if}

    <!-- Step 1: Configure amount and fee -->
    {#if step === 'configure'}
      <Alert.Root>
        <AlertTriangle class="h-4 w-4" />
        <Alert.Description class="text-xs">
          <strong>Warning:</strong> Locked BTC cannot be recovered until the timelock expires. Keys are
          generated in your browser and never sent to the server.
        </Alert.Description>
      </Alert.Root>

      <div class="space-y-2">
        <Label for="btc-amount">Amount (sats)</Label>
        <Input
          id="btc-amount"
          type="number"
          min={10_000}
          max={10_000_000}
          bind:value={amountSats}
          placeholder="50000"
        />
        {#if amountSats < 10_000}
          <p class="text-destructive text-xs">Minimum amount is 10,000 sats.</p>
        {:else if amountSats > 10_000_000}
          <p class="text-destructive text-xs">Maximum amount is 10,000,000 sats.</p>
        {:else}
          <p class="text-muted-foreground text-xs">
            {(amountSats / 100_000_000).toFixed(8)} BTC
          </p>
        {/if}
      </div>

      <div class="space-y-2">
        <Label for="fee-priority">Fee Priority</Label>
        <Select.Root type="single" bind:value={feePriority}>
          <Select.Trigger id="fee-priority">
            <span>{feeEstimates[feePriority]?.label ?? 'Select priority'}</span>
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="low">{feeEstimates.low.label} (~{feeEstimates.low.rate} sat/vB)</Select.Item>
            <Select.Item value="medium">{feeEstimates.medium.label} (~{feeEstimates.medium.rate} sat/vB)</Select.Item>
            <Select.Item value="high">{feeEstimates.high.label} (~{feeEstimates.high.rate} sat/vB)</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>

      <div class="space-y-2">
        <Label for="btc-network">Network</Label>
        <Select.Root type="single" bind:value={network}>
          <Select.Trigger id="btc-network">
            <span>{network === 'testnet' ? 'Testnet' : 'Mainnet'}</span>
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="testnet">Testnet (recommended for testing)</Select.Item>
            <Select.Item value="mainnet">Mainnet (real BTC)</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>

      <div class="bg-muted/50 rounded-lg p-3">
        <h4 class="mb-2 text-sm font-medium">Estimated Cost</h4>
        <div class="space-y-1 text-xs">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Lock amount</span>
            <span>{amountSats.toLocaleString()} sats</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Est. tx fee (~153 vB)</span>
            <span>{estimatedFee.toLocaleString()} sats</span>
          </div>
          <Separator class="my-1" />
          <div class="flex justify-between font-medium">
            <span>Total to send</span>
            <span>{totalRequired.toLocaleString()} sats</span>
          </div>
        </div>
      </div>

    <!-- Step 2: Fund the address -->
    {:else if step === 'fund'}
      <div class="space-y-4">
        <div class="space-y-2">
          <Label>Funding Address</Label>
          <p class="text-muted-foreground text-xs">
            Send exactly <strong>{totalRequired.toLocaleString()} sats</strong> to this address:
          </p>
          <div class="bg-muted flex items-center gap-2 rounded-lg p-3">
            <code class="flex-1 break-all font-mono text-xs">{fundingAddress}</code>
            <Button variant="ghost" size="sm" onclick={copyAddress} class="shrink-0">
              {#if addressCopied}
                <Check class="h-4 w-4" />
              {:else}
                <Copy class="h-4 w-4" />
              {/if}
            </Button>
          </div>
        </div>

        <Separator />

        <div class="space-y-2">
          <Label for="funding-txid">Funding Transaction ID</Label>
          <p class="text-muted-foreground text-xs">
            After sending, enter the transaction ID below.
          </p>
          <Input
            id="funding-txid"
            type="text"
            bind:value={fundingTxId}
            placeholder="e.g. a1b2c3d4..."
            class="font-mono text-xs"
          />
          {#if fundingTxId && !isFundingTxIdValid}
            <p class="text-destructive text-xs">Must be a 64-character hex string.</p>
          {/if}
        </div>

        <div class="space-y-2">
          <Label for="funding-vout">Output Index (vout)</Label>
          <Input
            id="funding-vout"
            type="number"
            min={0}
            bind:value={fundingOutputIndex}
            placeholder="0"
          />
          <p class="text-muted-foreground text-xs">
            Usually 0 unless the payment is not the first output.
          </p>
        </div>
      </div>

    <!-- Step 3: Confirm before proceeding -->
    {:else if step === 'confirm'}
      <div class="space-y-3 text-sm">
        <h4 class="font-medium">Confirm Bitcoin Timelock</h4>
        <div class="bg-muted/50 space-y-2 rounded-lg p-3 text-xs">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Lock amount</span>
            <span>{amountSats.toLocaleString()} sats</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Fee rate</span>
            <span>{feeRate} sat/vB</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">CSV delay</span>
            <span>{ttlBlocks} blocks (~{checkInDays} days)</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Network</span>
            <span>{network}</span>
          </div>
          <Separator class="my-1" />
          <div class="flex justify-between">
            <span class="text-muted-foreground">Funding TX</span>
            <span class="max-w-[200px] truncate font-mono">{fundingTxId.trim()}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Output index</span>
            <span>{fundingOutputIndex}</span>
          </div>
        </div>
        <Alert.Root>
          <AlertTriangle class="h-4 w-4" />
          <Alert.Description class="text-xs">
            This will create and broadcast a Bitcoin transaction. The locked funds cannot be
            recovered until the timelock expires. This action cannot be undone.
          </Alert.Description>
        </Alert.Root>
      </div>

    <!-- Step 4: Processing -->
    {:else if step === 'processing'}
      <div class="flex flex-col items-center gap-3 py-6">
        <Loader2 class="text-muted-foreground h-8 w-8 animate-spin" />
        <p class="text-muted-foreground text-sm">Creating and broadcasting timelock transaction...</p>
        <p class="text-muted-foreground text-xs">This may take a moment.</p>
      </div>

    <!-- Step 5: Done -->
    {:else if step === 'done'}
      <div class="flex flex-col items-center gap-3 py-6">
        <div class="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
          <Check class="text-primary h-6 w-6" />
        </div>
        <p class="text-sm font-medium">Bitcoin timelock enabled</p>
        <p class="text-muted-foreground text-center text-xs">
          Your funds are locked. The recipient can claim them after {ttlBlocks} blocks
          (~{checkInDays} days) if you stop checking in.
        </p>
      </div>
    {/if}
  </Card.Content>

  <Card.Footer class="flex gap-2">
    {#if step === 'configure'}
      <Button onclick={handleGenerateKeys} disabled={!isAmountValid} class="w-full">
        <Wallet class="mr-2 h-4 w-4" />
        Generate Keys &amp; Get Address
      </Button>
    {:else if step === 'fund'}
      <Button variant="outline" onclick={handleStartOver} class="shrink-0">
        Back
      </Button>
      <Button
        onclick={handleFundingConfirmed}
        disabled={!isFundingTxIdValid || !isFundingOutputIndexValid}
        class="flex-1"
      >
        I've Sent the Funds
      </Button>
    {:else if step === 'confirm'}
      <Button variant="outline" onclick={() => (step = 'fund')} class="shrink-0">
        Back
      </Button>
      <Button onclick={handleEnableBitcoin} disabled={loading} class="flex-1">
        <Bitcoin class="mr-2 h-4 w-4" />
        Enable Bitcoin Timelock
      </Button>
    {:else if step === 'done'}
      <!-- No actions needed; parent will react to onSetupComplete -->
    {/if}
  </Card.Footer>
</Card.Root>
