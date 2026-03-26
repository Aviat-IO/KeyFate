<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Alert from '$lib/components/ui/alert';
  import {
    Lock,
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
  } from '@lucide/svelte';
  import type { DecryptedShareResult } from '$lib/crypto/recovery-flows';
  import RecoveryMethodSelector from '$lib/components/RecoveryMethodSelector.svelte';
  import RecoveryGuide from '$lib/components/RecoveryGuide.svelte';
  import NostrRecoveryStep from '$lib/components/recovery/NostrRecoveryStep.svelte';
  import BitcoinRecoveryStep from '$lib/components/recovery/BitcoinRecoveryStep.svelte';
  import PassphraseRecoveryStep from '$lib/components/recovery/PassphraseRecoveryStep.svelte';
  import RecoveryResultStep from '$lib/components/recovery/RecoveryResultStep.svelte';

  // ─── State ───────────────────────────────────────────────────────────────

  type RecoveryMethod = 'nostr' | 'bitcoin' | 'passphrase';
  type Step = 'choose' | 'recover' | 'result';

  let currentStep = $state<Step>('choose');
  let selectedMethod = $state<RecoveryMethod | null>(null);
  let chooserSelection = $state<RecoveryMethod>('nostr');

  // Accumulated shares for Shamir reconstruction
  let recoveredShares = $state<string[]>([]);

  // Results
  let decryptedShares = $state<DecryptedShareResult[]>([]);
  let error = $state<string | null>(null);

  // ─── Methods ─────────────────────────────────────────────────────────────

  function selectMethod(method: RecoveryMethod) {
    selectedMethod = method;
    currentStep = 'recover';
    error = null;
  }

  function goBack() {
    if (currentStep === 'result') {
      currentStep = 'recover';
      decryptedShares = [];
    } else if (currentStep === 'recover') {
      currentStep = 'choose';
      selectedMethod = null;
      chooserSelection = 'nostr';
      error = null;
    }
  }

  function handleRecoveryComplete(results: DecryptedShareResult[]) {
    decryptedShares = results;
    for (const r of results) {
      if (r.share && !recoveredShares.includes(r.share)) {
        recoveredShares = [...recoveredShares, r.share];
      }
    }
    currentStep = 'result';
  }

  function handleError(message: string) {
    error = message || null;
  }

  function recoverAnotherShare() {
    currentStep = 'choose';
    selectedMethod = null;
    chooserSelection = 'nostr';
    decryptedShares = [];
    error = null;
  }
</script>

<svelte:head>
  <title>Recover Shares - KeyFate</title>
  <meta
    name="description"
    content="Recover your encrypted shares using Nostr, Bitcoin, or a passphrase."
  />
</svelte:head>

<div class="bg-background min-h-screen">
  <div class="mx-auto max-w-3xl px-6 py-12">
    <!-- Header -->
    <div class="mb-12">
      <h1 class="font-space text-3xl font-light tracking-tight">Recover Your Shares</h1>
      <p class="text-muted-foreground mt-2 text-sm">
        Decrypt your secret shares using one of three recovery methods.
        This page works entirely in your browser — no data is sent to any server.
      </p>
    </div>

    <!-- Back button -->
    {#if currentStep !== 'choose'}
      <Button variant="ghost" onclick={goBack} class="mb-4">
        <ArrowLeft class="mr-2 h-4 w-4" />
        Back
      </Button>
    {/if}

    <!-- Error display -->
    {#if error}
      <Alert.Alert variant="destructive" class="mb-6">
        <AlertTriangle class="h-4 w-4" />
        <Alert.AlertTitle>Error</Alert.AlertTitle>
        <Alert.AlertDescription>{error}</Alert.AlertDescription>
      </Alert.Alert>
    {/if}

    <!-- Step 1: Choose recovery method -->
    {#if currentStep === 'choose'}
      <RecoveryMethodSelector
        bind:selected={chooserSelection}
        availableMethods={['nostr', 'bitcoin', 'passphrase']}
      />

      <Button onclick={() => selectMethod(chooserSelection)} class="mt-6 w-full">
        <ArrowRight class="mr-2 h-4 w-4" />
        Continue
      </Button>

      <RecoveryGuide class="mt-6" />

      <Alert.Alert class="mt-6">
        <Lock class="h-4 w-4" />
        <Alert.AlertTitle>Security Notice</Alert.AlertTitle>
        <Alert.AlertDescription>
          All decryption happens locally in your browser. Your private keys and passphrases
          are never transmitted. For maximum security, use this page offline after loading it.
        </Alert.AlertDescription>
      </Alert.Alert>
    {/if}

    <!-- Step 2a: Nostr Recovery -->
    {#if currentStep === 'recover' && selectedMethod === 'nostr'}
      <NostrRecoveryStep
        onComplete={handleRecoveryComplete}
        onError={handleError}
      />
    {/if}

    <!-- Step 2b: Bitcoin Recovery -->
    {#if currentStep === 'recover' && selectedMethod === 'bitcoin'}
      <BitcoinRecoveryStep
        onComplete={handleRecoveryComplete}
        onError={handleError}
      />
    {/if}

    <!-- Step 2c: Passphrase Recovery -->
    {#if currentStep === 'recover' && selectedMethod === 'passphrase'}
      <PassphraseRecoveryStep
        onComplete={handleRecoveryComplete}
        onError={handleError}
      />
    {/if}

    <!-- Step 3: Results -->
    {#if currentStep === 'result'}
      <RecoveryResultStep
        {decryptedShares}
        {recoveredShares}
        onRecoverAnother={recoverAnotherShare}
      />
    {/if}
  </div>
</div>
