<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Alert from '$lib/components/ui/alert';
	import { Lock, AlertTriangle, ArrowLeft, ArrowRight } from '@lucide/svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { parseRecoveryShareEnvelope } from '$lib/crypto/recovery-v3';
	import type { DecryptedShareResult } from '$lib/crypto/recovery-flows';
	import RecoveryMethodSelector from '$lib/components/RecoveryMethodSelector.svelte';
	import RecoveryGuide from '$lib/components/RecoveryGuide.svelte';
	import NostrRecoveryStep from '$lib/components/recovery/NostrRecoveryStep.svelte';
	import LegacyNostrRecoveryStep from '$lib/components/recovery/LegacyNostrRecoveryStep.svelte';
	import BitcoinRecoveryStep from '$lib/components/recovery/BitcoinRecoveryStep.svelte';
	import PassphraseRecoveryStep from '$lib/components/recovery/PassphraseRecoveryStep.svelte';
	import RecoveryResultStep from '$lib/components/recovery/RecoveryResultStep.svelte';

	// ─── State ───────────────────────────────────────────────────────────────

	type RecoveryMethod = 'nostr' | 'bitcoin' | 'passphrase';
	type Step = 'choose' | 'recover' | 'result';

	let currentStep = $state<Step>('choose');
	let selectedMethod = $state<RecoveryMethod | null>(null);
	let chooserSelection = $state<RecoveryMethod>('nostr');
	let unverifiedLegacyMode = $state(false);

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
		try {
			if (!unverifiedLegacyMode) {
				for (const result of results) {
					const envelope = parseRecoveryShareEnvelope(result.share);
					if (
						envelope.index !== result.shareIndex ||
						envelope.threshold !== result.threshold ||
						envelope.total !== result.totalShares
					) {
						throw new Error('Recovered envelope metadata does not match the typed recovery result');
					}
				}
			}
			decryptedShares = results;
			for (const result of results)
				if (result.share && !recoveredShares.includes(result.share))
					recoveredShares = [...recoveredShares, result.share];
			currentStep = 'result';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Invalid authenticated recovery envelope';
		}
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
				Cryptography runs locally in this browser. Nostr recovery queries the relay URLs pinned in
				the owner-delivered setup bundle; trusted page code and the browser origin can observe
				plaintext.
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
			<div class="border-border mb-4 flex items-start gap-3 rounded-md border p-4">
				<Checkbox
					id="legacy-recovery"
					checked={unverifiedLegacyMode}
					onCheckedChange={(checked) => {
						unverifiedLegacyMode = checked === true;
						chooserSelection = 'nostr';
					}}
				/>
				<div>
					<Label for="legacy-recovery">Unverified legacy transport mode</Label>
					<p class="text-muted-foreground text-sm">
						Deliberately enable only for old Nostr, Bitcoin, or passphrase artifacts. They do not
						provide authenticated v3 reconstruction or substitution detection.
					</p>
				</div>
			</div>
			<RecoveryMethodSelector
				bind:selected={chooserSelection}
				availableMethods={unverifiedLegacyMode ? ['nostr', 'bitcoin', 'passphrase'] : ['nostr']}
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
					Cryptographic operations run locally after the page loads. Trusted KeyFate page code,
					browser extensions, and this browser origin can still observe keys and plaintext. Use the
					documented offline build on a trusted device for sensitive recovery.
				</Alert.AlertDescription>
			</Alert.Alert>
		{/if}

		<!-- Step 2a: Nostr Recovery -->
		{#if currentStep === 'recover' && selectedMethod === 'nostr'}
			{#if unverifiedLegacyMode}
				<LegacyNostrRecoveryStep onComplete={handleRecoveryComplete} onError={handleError} />
			{:else}
				<NostrRecoveryStep onComplete={handleRecoveryComplete} onError={handleError} />
			{/if}
		{/if}

		<!-- Step 2b: Bitcoin Recovery -->
		{#if currentStep === 'recover' && selectedMethod === 'bitcoin'}
			<BitcoinRecoveryStep onComplete={handleRecoveryComplete} onError={handleError} />
		{/if}

		<!-- Step 2c: Passphrase Recovery -->
		{#if currentStep === 'recover' && selectedMethod === 'passphrase'}
			<PassphraseRecoveryStep onComplete={handleRecoveryComplete} onError={handleError} />
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
