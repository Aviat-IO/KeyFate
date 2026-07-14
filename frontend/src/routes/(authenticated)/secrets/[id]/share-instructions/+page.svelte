<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Alert from '$lib/components/ui/alert';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Copy, AlertTriangle, CheckCircle, Download, Info, Loader2, Send } from '@lucide/svelte';
	import {
		clearEphemeralRecoveryState,
		getEphemeralRecoveryState,
		partitionRecoveryShares
	} from '$lib/client/ephemeral-recovery-state';
	import { encryptRecoveryKit } from '$lib/crypto/recovery-kit';
	import BitcoinOwnerSetup from '$lib/components/bitcoin/BitcoinOwnerSetup.svelte';
	import type { EphemeralBitcoinSetup } from '$lib/client/ephemeral-recovery-state';

	let { data } = $props();

	let userManagedShares = $state<string[]>([]);
	let recipientShares = $state<string[]>([]);
	let backupShares = $state<string[]>([]);
	let recipients = $state<Array<{ name: string; email?: string | null }>>([]);
	let sssSharesTotal = $state(0);
	let sssThreshold = $state(0);
	let secretId = $state<string | null>(null);
	let error = $state<string | null>(null);
	let confirmedSent = $state(false);
	let copiedIndex = $state<number | null>(null);
	let kitPassphrase = $state('');
	let kitPassphraseConfirmation = $state('');
	let exportingKit = $state(false);
	let kitDownloaded = $state(false);
	let bitcoinSetup = $state<EphemeralBitcoinSetup | null>(null);
	let bitcoinKitDownloaded = $state(false);

	onMount(() => {
		const searchParams = $page.url.searchParams;
		const id = searchParams.get('secretId');
		const total = parseInt(searchParams.get('sss_shares_total') || '0', 10);
		const threshold = parseInt(searchParams.get('sss_threshold') || '0', 10);
		const recipientsParam = searchParams.get('recipients');

		if (!id || total < 2 || threshold < 2 || threshold > total) {
			error =
				'Critical information missing or invalid. Unable to display share instructions. Please try creating the secret again.';
			return;
		}

		let parsedRecipients: Array<{ name: string; email?: string | null }> = [];
		if (recipientsParam) {
			try {
				parsedRecipients = JSON.parse(decodeURIComponent(recipientsParam));
			} catch {
				error = 'Failed to parse recipients. Please re-create the secret.';
				return;
			}
		}

		const recoveryState = getEphemeralRecoveryState(id);
		if (!recoveryState) {
			error =
				'Your in-memory recovery material is unavailable. Reloading intentionally clears it; delete and re-create this secret.';
			return;
		}

		if (recoveryState.shares.length !== total - 1) {
			error = 'Share count mismatch. Please re-create the secret.';
			return;
		}

		let partitionedShares: ReturnType<typeof partitionRecoveryShares>;
		try {
			partitionedShares = partitionRecoveryShares(recoveryState.shares, parsedRecipients.length);
		} catch {
			error = 'Recipient share count mismatch. Please re-create the secret.';
			return;
		}

		secretId = id;
		userManagedShares = recoveryState.shares;
		recipientShares = partitionedShares.recipientShares;
		backupShares = partitionedShares.backupShares;
		sssSharesTotal = total;
		sssThreshold = threshold;
		recipients = parsedRecipients;
		bitcoinSetup = recoveryState.bitcoin ?? null;
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
			error = 'Use a recovery-kit passphrase of at least 12 characters.';
			return;
		}
		if (kitPassphrase !== kitPassphraseConfirmation) {
			error = 'Recovery-kit passphrases do not match.';
			return;
		}
		const state = getEphemeralRecoveryState(secretId);
		if (!state) {
			error = 'Recovery material expired. Delete and re-create this secret.';
			return;
		}

		exportingKit = true;
		error = null;
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
			error =
				downloadError instanceof Error ? downloadError.message : 'Failed to encrypt recovery kit';
		} finally {
			exportingKit = false;
		}
	}

	function handleProceed() {
		if (confirmedSent && kitDownloaded && (!bitcoinSetup || bitcoinKitDownloaded) && secretId) {
			clearEphemeralRecoveryState(secretId);
			userManagedShares = [];
			recipientShares = [];
			backupShares = [];
			goto('/dashboard');
		}
	}

	function createMailto(
		recipient: { name: string; email?: string | null },
		share: string
	): string | null {
		if (!recipient.email || !share) return null;
		const subject = encodeURIComponent('Your KeyFate Secret Share');
		const bodyParts = [
			`Hi ${recipient.name || 'there'},`,
			'',
			`Here is your KeyFate secret share: ${share}`,
			'',
			`Please keep this very safe. Recovery requires ${sssThreshold} distinct shares. KeyFate will provide its service share if the secret expires, but additional shares may still be required.`,
			'',
			"What is KeyFate? It's a dead man's switch service. The person who set this up has stored an encrypted message that will be made accessible to you if they fail to check in regularly.",
			'',
			'For more information on how to use this share for recovery, you will receive further instructions from KeyFate if/when the secret is triggered.'
		];
		const body = encodeURIComponent(bodyParts.join('\n'));
		return `mailto:${recipient.email}?subject=${subject}&body=${body}`;
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
			Your secret has been successfully created and split into {sssSharesTotal} shares. You need {sssThreshold}
			shares to recover it.
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
							<strong>Share 0 (KeyFate):</strong> Automatically sent to recipients when triggered.
						</li>
						<li>
							<strong>Recipient shares:</strong> Each recipient gets only their assigned share. Sending
							the same share over two channels does not create another recovery share.
						</li>
						{#if backupShares.length > 0}
							<li>
								<strong>Owner backup shares:</strong> Store the remaining {backupShares.length}
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
					<div class="border-border/50 space-y-3 rounded-md border p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="flex-1">
								<p class="font-medium">Share {index + 1}: {recipient.name}</p>
								<p class="text-muted-foreground text-sm">
									{recipient.email || 'No email provided'}
								</p>
							</div>
							{#if recipient.email}
								{@const mailto = createMailto(recipient, assignedShare)}
								{#if mailto}
									<Button variant="outline" size="sm" href={mailto} class="font-semibold">
										<Send class="mr-2 h-4 w-4" />
										Email Share
									</Button>
								{/if}
							{/if}
						</div>
						<div class="flex items-center space-x-2">
							<Input readonly value={assignedShare} class="bg-muted truncate text-sm" />
							<Button
								type="button"
								size="icon"
								variant="outline"
								onclick={() => handleCopy(assignedShare, index)}
							>
								{#if copiedIndex === index}
									<CheckCircle class="text-accent-foreground h-4 w-4" />
								{:else}
									<Copy class="h-4 w-4" />
								{/if}
							</Button>
						</div>
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
								Share {recipients.length + index + 1}: Backup Share {index + 1}
							</Label>
							<div class="flex items-center space-x-2">
								<Input readonly value={share} class="bg-muted truncate text-sm" />
								<Button
									type="button"
									size="icon"
									variant="outline"
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
				<Alert.Title class="text-lg">
					{sssThreshold === sssSharesTotal
						? 'CRITICAL: All Shares Must Be Distributed'
						: 'Action Required: Distribute Share 1'}
				</Alert.Title>
				<Alert.Description class="text-foreground space-y-3">
					<p>
						Distribute Share 1 to each recipient using secure channels. Without it, recipients
						cannot recover your secret when triggered.
					</p>
					<p>
						<strong>Secure methods:</strong> Signal, password manager sharing, encrypted file, in-person,
						or email (buttons above).
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
					I have distributed {sssThreshold === sssSharesTotal ? 'all required shares' : 'Share 1'},
					downloaded the encrypted owner kit, and understand that this tab will clear its plaintext
					copy.
				</Label>
			</div>

			<div class="flex justify-end pt-8">
				<Button
					onclick={handleProceed}
					disabled={!confirmedSent ||
						!kitDownloaded ||
						(!!bitcoinSetup && !bitcoinKitDownloaded) ||
						userManagedShares.length === 0}
					size="lg"
					class="w-full font-semibold md:w-auto"
				>
					{confirmedSent && kitDownloaded && (!bitcoinSetup || bitcoinKitDownloaded)
						? 'Clear Plaintext and Proceed'
						: 'Complete Distribution and Required Kit Downloads'}
				</Button>
			</div>
		</div>
	</div>
{/if}
