<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Alert from '$lib/components/ui/alert';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Copy, AlertTriangle, CheckCircle, Download, Info, Loader2 } from '@lucide/svelte';
	import {
		clearEphemeralRecoveryState,
		getEphemeralRecoveryState,
		partitionRecoveryShares
	} from '$lib/client/ephemeral-recovery-state';
	import { encryptRecoveryKit } from '$lib/crypto/recovery-kit';
	import BitcoinOwnerSetup from '$lib/components/bitcoin/BitcoinOwnerSetup.svelte';
	import type {
		EphemeralBitcoinSetup,
		EphemeralNostrArtifact
	} from '$lib/client/ephemeral-recovery-state';
	import { serializeRecoverySetupBundleV3 } from '$lib/nostr/recovery-v3-artifact';
	import { buildNostrRegistrationPayload } from '$lib/client/secret-creation-payload';

	let { data } = $props();

	let userManagedShares = $state<string[]>([]);
	let recipientShares = $state<string[]>([]);
	let backupShares = $state<string[]>([]);
	let recipients = $state<Array<{ name: string; email?: string | null }>>([]);
	let sssSharesTotal = $state(0);
	let sssThreshold = $state(0);
	let secretId = $state<string | null>(null);
	let error = $state<string | null>(null);
	let actionError = $state<string | null>(null);
	let confirmedSent = $state(false);
	let copiedIndex = $state<number | null>(null);
	let kitPassphrase = $state('');
	let kitPassphraseConfirmation = $state('');
	let exportingKit = $state(false);
	let kitDownloaded = $state(false);
	let bitcoinSetup = $state<EphemeralBitcoinSetup | null>(null);
	let bitcoinKitDownloaded = $state(false);
	let nostrArtifacts = $state<EphemeralNostrArtifact[]>([]);
	let downloadedSetupRecipients = $state<string[]>([]);
	let finalizing = $state(false);
	let allSetupBundlesDownloaded = $derived(
		nostrArtifacts.length === 0 ||
			nostrArtifacts.every((artifact) => downloadedSetupRecipients.includes(artifact.recipientId))
	);

	onMount(() => {
		const id = data.secretId;
		const recoveryState = getEphemeralRecoveryState(id);
		if (!recoveryState) {
			error =
				'Your in-memory recovery material is unavailable. Reloading intentionally clears it; delete and re-create this secret.';
			return;
		}

		if (
			recoveryState.threshold !== 2 ||
			recoveryState.totalShares < 3 ||
			recoveryState.shares.length !== recoveryState.totalShares - 1
		) {
			error = 'Share count mismatch. Please re-create the secret.';
			return;
		}

		let partitionedShares: ReturnType<typeof partitionRecoveryShares>;
		try {
			partitionedShares = partitionRecoveryShares(
				recoveryState.shares,
				recoveryState.recipients.length
			);
		} catch {
			error = 'Recipient share count mismatch. Please re-create the secret.';
			return;
		}

		secretId = id;
		userManagedShares = recoveryState.shares;
		recipientShares = partitionedShares.recipientShares;
		backupShares = partitionedShares.backupShares;
		sssSharesTotal = recoveryState.totalShares;
		sssThreshold = recoveryState.threshold;
		recipients = recoveryState.recipients;
		bitcoinSetup = recoveryState.bitcoin ?? null;
		nostrArtifacts = recoveryState.nostr?.artifacts ?? [];
		if (bitcoinSetup && !data.bitcoinEnrollmentEnabled) {
			error =
				'Bitcoin enrollment became unavailable. Delete and re-create this secret without Bitcoin.';
		}
	});

	function handleCopy(shareHex: string, index: number) {
		navigator.clipboard.writeText(shareHex);
		copiedIndex = index;
		setTimeout(() => (copiedIndex = null), 2000);
	}

	async function downloadEncryptedKit() {
		if (!secretId || kitPassphrase.length < 12) {
			actionError = 'Use a recovery-kit passphrase of at least 12 characters.';
			return;
		}
		if (kitPassphrase !== kitPassphraseConfirmation) {
			actionError = 'Recovery-kit passphrases do not match.';
			return;
		}
		const state = getEphemeralRecoveryState(secretId);
		if (!state) {
			actionError = 'Recovery material expired. Delete and re-create this secret.';
			return;
		}

		exportingKit = true;
		actionError = null;
		try {
			const envelope = await encryptRecoveryKit(
				{
					metadata: {
						secretId,
						threshold: sssThreshold,
						totalShares: sssSharesTotal,
						recipients,
						exportedAt: new Date().toISOString()
					},
					userManagedShares: state.shares,
					nostr: state.nostr ?? null
				},
				kitPassphrase
			);
			const url = URL.createObjectURL(
				new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
			);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = `keyfate-owner-recovery-kit-${secretId}.json`;
			anchor.click();
			URL.revokeObjectURL(url);
			kitDownloaded = true;
			kitPassphrase = '';
			kitPassphraseConfirmation = '';
		} catch (downloadError) {
			actionError =
				downloadError instanceof Error ? downloadError.message : 'Failed to encrypt recovery kit';
		} finally {
			exportingKit = false;
		}
	}

	function downloadSetupBundle(artifact: EphemeralNostrArtifact, recipientName: string) {
		const url = URL.createObjectURL(
			new Blob([serializeRecoverySetupBundleV3(artifact.setupBundle)], {
				type: 'application/json'
			})
		);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `keyfate-recipient-setup-${recipientName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
		anchor.click();
		URL.revokeObjectURL(url);
		if (!downloadedSetupRecipients.includes(artifact.recipientId)) {
			downloadedSetupRecipients = [...downloadedSetupRecipients, artifact.recipientId];
		}
	}

	async function getCsrfToken(): Promise<string> {
		const response = await fetch('/api/csrf-token');
		if (!response.ok) throw new Error('Failed to initialize protected request');
		const body: unknown = await response.json();
		if (
			!body ||
			typeof body !== 'object' ||
			typeof (body as { token?: unknown }).token !== 'string'
		) {
			throw new Error('Invalid CSRF token response');
		}
		return (body as { token: string }).token;
	}

	async function handleProceed() {
		if (
			!confirmedSent ||
			!kitDownloaded ||
			!allSetupBundlesDownloaded ||
			(!!bitcoinSetup && !bitcoinKitDownloaded) ||
			!secretId
		)
			return;
		finalizing = true;
		actionError = null;
		try {
			if (nostrArtifacts.length > 0) {
				const registrationToken = await getCsrfToken();
				const registration = await fetch(`/api/secrets/${secretId}/publish-nostr`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-csrf-token': registrationToken
					},
					body: JSON.stringify(
						buildNostrRegistrationPayload(
							nostrArtifacts.map((artifact) => ({
								giftWrapEvent: artifact.giftWrapEvent,
								capsuleEvent: artifact.capsuleEvent,
								manifestEvent: artifact.manifestEvent
							}))
						)
					)
				});
				if (!registration.ok) {
					const body = await registration.json();
					throw new Error(body.error || 'Failed to register retained Nostr artifacts');
				}
				const finalizationToken = await getCsrfToken();
				const response = await fetch(`/api/secrets/${secretId}/finalize-nostr`, {
					method: 'POST',
					headers: { 'x-csrf-token': finalizationToken }
				});
				if (!response.ok) {
					const body = await response.json();
					throw new Error(body.error || 'Failed to finalize Nostr setup');
				}
			}
			clearEphemeralRecoveryState(secretId);
			userManagedShares = [];
			recipientShares = [];
			backupShares = [];
			goto('/dashboard');
		} catch (finalizeError) {
			actionError =
				finalizeError instanceof Error ? finalizeError.message : 'Failed to finalize setup';
		} finally {
			finalizing = false;
		}
	}
</script>

<svelte:head>
	<title>Share Instructions - KeyFate</title>
</svelte:head>

{#if error}
	<div class="mx-auto max-w-2xl px-6 py-12">
		<Alert.Root variant="destructive">
			<AlertTriangle class="h-4 w-4" />
			<Alert.Title>Error</Alert.Title>
			<Alert.Description>{error}</Alert.Description>
		</Alert.Root>
	</div>
{:else if !secretId || userManagedShares.length === 0}
	<div class="mx-auto max-w-2xl px-6 py-12 text-center">
		<p>Loading share information...</p>
	</div>
{:else}
	<div class="mx-auto max-w-2xl px-6 py-12">
		<h1 class="font-space mb-3 text-3xl font-light tracking-tight">Manage Your Secret Shares</h1>
		<p class="text-muted-foreground mb-10">
			Your structured secret was authenticated-encrypted under a random content key. Only that key
			was split into {sssSharesTotal} recovery envelopes; {sssThreshold} distinct envelope indices are
			required.
		</p>
		<div class="space-y-10">
			<Alert.Root>
				<Info class="h-4 w-4" />
				<Alert.Title>How Recovery Works</Alert.Title>
				<Alert.Description>
					<p class="mb-2">
						Your secret requires <strong>{sssThreshold} of {sssSharesTotal}</strong> shares to recover.
					</p>
					<ul class="mt-2 list-disc space-y-1 pl-5">
						<li>
							<strong>Envelope index 1 (KeyFate):</strong> Automatically sent to recipients when triggered.
						</li>
						<li>
							<strong>Envelope index 2 (recipients):</strong> Every recipient receives a separately encrypted
							copy of the same logical envelope. Sending it over two channels does not create another
							recovery share.
						</li>
						{#if backupShares.length > 0}
							<li>
								<strong>Owner backup envelopes (indices 3+):</strong> Store the remaining {backupShares.length}
								{backupShares.length === 1 ? 'share' : 'shares'} securely offline.
							</li>
						{/if}
					</ul>
				</Alert.Description>
			</Alert.Root>

			<!-- Distribution Checklist -->
			<div class="space-y-4">
				<h3 class="font-space text-lg font-bold tracking-tight">Distribution Checklist</h3>
				{#each recipients as recipient, index}
					{@const assignedShare = recipientShares[index]}
					{@const artifact = nostrArtifacts[index]}
					<div class="border-border/50 space-y-3 rounded-md border p-3">
						<div>
							<p class="font-medium">
								Recipient {index + 1}: {artifact?.recipientName ?? recipient.name}
							</p>
							<p class="text-muted-foreground text-sm">
								{artifact?.recipientEmail || recipient.email || 'No email provided'}
							</p>
						</div>
						{#if artifact}
							<p class="text-muted-foreground text-sm">
								Download this recipient's signed setup bundle and deliver the file through an
								owner-controlled channel. It contains no plaintext share.
							</p>
							<Button
								type="button"
								variant="outline"
								onclick={() => downloadSetupBundle(artifact, artifact.recipientName)}
							>
								{#if downloadedSetupRecipients.includes(artifact.recipientId)}
									<CheckCircle class="mr-2 h-4 w-4" /> Download again
								{:else}
									<Download class="mr-2 h-4 w-4" /> Download setup bundle
								{/if}
							</Button>
						{:else}
							<p class="text-muted-foreground text-sm">
								Copy this share and transfer it manually through a secure channel. It is never
								placed in a URL or generated email link.
							</p>
							<div class="flex items-center space-x-2">
								<Input readonly value={assignedShare} class="bg-muted truncate text-sm" />
								<Button
									type="button"
									size="icon"
									variant="outline"
									aria-label={`${copiedIndex === index ? 'Copied' : 'Copy'} recovery share for ${recipient.name}`}
									onclick={() => handleCopy(assignedShare, index)}
								>
									{#if copiedIndex === index}<CheckCircle
											class="text-accent-foreground h-4 w-4"
										/>{:else}<Copy class="h-4 w-4" />{/if}
								</Button>
							</div>
						{/if}
					</div>
				{/each}
			</div>

			{#if backupShares.length > 0}
				<div class="space-y-4">
					<h3 class="font-space text-lg font-bold tracking-tight">Backup Shares</h3>
					<p class="text-muted-foreground text-sm">
						{sssThreshold === sssSharesTotal
							? 'These shares are REQUIRED for recovery. Store them securely offline.'
							: 'Optional redundancy shares. Store securely offline.'}
					</p>
					{#each backupShares as share, index}
						<div class="space-y-2">
							<Label class="font-space text-lg font-bold tracking-tight">
								Envelope index {index + 3}: Owner Backup {index + 1}
							</Label>
							<div class="flex items-center space-x-2">
								<Input readonly value={share} class="bg-muted truncate text-sm" />
								<Button
									type="button"
									size="icon"
									variant="outline"
									aria-label={`${copiedIndex === recipients.length + index ? 'Copied' : 'Copy'} backup recovery share ${index + 1}`}
									onclick={() => handleCopy(share, recipients.length + index)}
								>
									{#if copiedIndex === recipients.length + index}
										<CheckCircle class="text-accent-foreground h-4 w-4" />
									{:else}
										<Copy class="h-4 w-4" />
									{/if}
								</Button>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if bitcoinSetup && data.bitcoinEnrollmentEnabled && secretId}
				<BitcoinOwnerSetup
					{secretId}
					setup={bitcoinSetup}
					oncomplete={() => (bitcoinKitDownloaded = true)}
				/>
			{/if}

			<div class="border-border space-y-4 rounded-md border p-4">
				<div>
					<h3 class="font-space font-bold tracking-tight">Download Encrypted Owner Kit</h3>
					<p class="text-muted-foreground mt-1 text-sm">
						This is the only durable owner copy. The plaintext shares are held only in this tab's
						memory.
					</p>
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="kit-passphrase">Kit passphrase</Label>
						<Input
							id="kit-passphrase"
							type="password"
							bind:value={kitPassphrase}
							autocomplete="new-password"
						/>
					</div>
					<div class="space-y-2">
						<Label for="kit-passphrase-confirmation">Confirm passphrase</Label>
						<Input
							id="kit-passphrase-confirmation"
							type="password"
							bind:value={kitPassphraseConfirmation}
							autocomplete="new-password"
						/>
					</div>
				</div>
				<Button
					type="button"
					variant="outline"
					onclick={downloadEncryptedKit}
					disabled={exportingKit || kitPassphrase.length < 12}
				>
					{#if exportingKit}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Encrypting…
					{:else if kitDownloaded}
						<CheckCircle class="mr-2 h-4 w-4" />
						Download another copy
					{:else}
						<Download class="mr-2 h-4 w-4" />
						Encrypt and download kit
					{/if}
				</Button>
				{#if kitDownloaded}
					<p class="text-accent-foreground text-sm">
						Encrypted kit downloaded. Store it separately from its passphrase.
					</p>
				{/if}
			</div>

			<Alert.Root variant="destructive" class="mt-6">
				<AlertTriangle class="mt-0.5 h-5 w-5" />
				<Alert.Title class="text-lg">Action Required: Complete Recipient Distribution</Alert.Title>
				<Alert.Description class="text-foreground space-y-3">
					<p>
						{nostrArtifacts.length > 0
							? 'Deliver every downloaded setup bundle through an owner-controlled channel. Registration alone does not activate this secret.'
							: 'Copy and distribute the shared recipient recovery envelope through a secure channel.'}
					</p>
					<p>
						<strong>Secure methods:</strong> Signal, password manager sharing, encrypted file, or in-person
						transfer. KeyFate does not generate share-bearing email links.
					</p>
				</Alert.Description>
			</Alert.Root>

			<div class="border-border/50 mt-8 flex items-center space-x-2 rounded-md border p-4">
				<Checkbox
					id="confirm-sent"
					checked={confirmedSent}
					onCheckedChange={(checked) => (confirmedSent = checked === true)}
				/>
				<Label
					for="confirm-sent"
					class="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
				>
					I have downloaded and distributed every required recipient artifact through an
					owner-controlled channel, downloaded the encrypted owner kit, and understand that this tab
					will clear its plaintext copy.
				</Label>
			</div>

			{#if actionError}
				<Alert.Root variant="destructive">
					<AlertTriangle class="h-4 w-4" />
					<Alert.Title>Setup remains paused</Alert.Title>
					<Alert.Description
						>{actionError} The signed artifacts remain in this tab; retry without recreating the secret.</Alert.Description
					>
				</Alert.Root>
			{/if}

			<div class="flex justify-end pt-8">
				<Button
					onclick={handleProceed}
					disabled={!confirmedSent ||
						!kitDownloaded ||
						!allSetupBundlesDownloaded ||
						(!!bitcoinSetup && !bitcoinKitDownloaded) ||
						userManagedShares.length === 0 ||
						finalizing}
					size="lg"
					class="w-full font-semibold md:w-auto"
				>
					{finalizing
						? 'Finalizing…'
						: confirmedSent &&
							  kitDownloaded &&
							  allSetupBundlesDownloaded &&
							  (!bitcoinSetup || bitcoinKitDownloaded)
							? 'Finalize, Clear Plaintext, and Proceed'
							: 'Complete Distribution and Required Kit Downloads'}
				</Button>
			</div>
		</div>
	</div>
{/if}
