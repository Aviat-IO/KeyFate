<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Accordion from '$lib/components/ui/accordion';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { Textarea } from '$lib/components/ui/textarea';
	import UpgradeModal from '$lib/components/UpgradeModal.svelte';
	import ThresholdSelector from '$lib/components/ThresholdSelector.svelte';
	import MessageTemplateSelector from '$lib/components/MessageTemplateSelector.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import NostrPubkeyInput from '$lib/components/NostrPubkeyInput.svelte';
	import {
		AlertCircle,
		AlertTriangle,
		Bitcoin,
		Crown,
		Info,
		Lock,
		Plus,
		Radio,
		Trash2
	} from '@lucide/svelte';
	import { Buffer } from 'buffer';
	import sss from 'shamirs-secret-sharing';
	import { generateSecretKey } from 'nostr-tools/pure';
	import { publishSharesToNostr } from '$lib/services/nostr-publisher';
	import {
		clearEphemeralRecoveryState,
		partitionRecoveryShares,
		setEphemeralNostrMetadata,
		setEphemeralRecoveryState
	} from '$lib/client/ephemeral-recovery-state';
	import {
		buildNostrRegistrationPayload,
		buildSecretCreationPayload
	} from '$lib/client/secret-creation-payload';

	let {
		isPaid = false,
		tierInfo
	}: {
		isPaid?: boolean;
		tierInfo?: {
			secretsUsed: number;
			secretsLimit: number;
			canCreate: boolean;
			recipientsLimit: number;
		};
	} = $props();

	let error = $state<string | null>(null);
	let showUpgradeModal = $state(false);
	let isSubmitting = $state(false);

	// Form state
	let title = $state('');
	let secretMessageContent = $state('');
	let recipients = $state<Array<{ name: string; email: string; nostrPubkey: string }>>([
		{ name: '', email: '', nostrPubkey: '' }
	]);
	let checkInDays = $state('365');
	let sssSharesTotal = $state(3);
	let sssThreshold = $state(2);

	// Bitcoin & Nostr settings (Pro only)
	let enableNostrShares = $state(false);
	let enableBitcoinTimelock = $state(false);

	// Validation errors
	let fieldErrors = $state<Record<string, string>>({});

	let maxRecipients = $derived(isPaid ? (tierInfo?.recipientsLimit ?? 5) : 1);
	let canAddMore = $derived(recipients.length < maxRecipients);

	let percentageUsed = $derived(
		tierInfo ? (tierInfo.secretsUsed / tierInfo.secretsLimit) * 100 : 0
	);
	let showWarning = $derived(tierInfo && percentageUsed >= 75 && tierInfo.canCreate);
	let isAtLimit = $derived(tierInfo && !tierInfo.canCreate);

	const CHECK_IN_OPTIONS: Array<{ value: string; label: string; paidOnly: boolean }> = [
		{ value: '1', label: '1 day', paidOnly: true },
		{ value: '3', label: '3 days', paidOnly: true },
		{ value: '7', label: '1 week', paidOnly: false },
		{ value: '14', label: '2 weeks', paidOnly: true },
		{ value: '30', label: '1 month', paidOnly: false },
		{ value: '90', label: '3 months', paidOnly: true },
		{ value: '180', label: '6 months', paidOnly: true },
		{ value: '365', label: '1 year', paidOnly: false },
		{ value: '1095', label: '3 years', paidOnly: true }
	];

	let availableOptions = $derived(CHECK_IN_OPTIONS.filter((opt) => isPaid || !opt.paidOnly));

	let selectedCheckInLabel = $derived(
		CHECK_IN_OPTIONS.find((opt) => opt.value === checkInDays)?.label ?? 'Select frequency'
	);

	function addRecipient() {
		recipients = [...recipients, { name: '', email: '', nostrPubkey: '' }];
	}

	function removeRecipient(index: number) {
		recipients = recipients.filter((_, i) => i !== index) as typeof recipients;
	}

	function handleTemplateSelect(content: string) {
		secretMessageContent = content;
	}

	function isValidEmail(email: string): boolean {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}

	function validate(): boolean {
		const errors: Record<string, string> = {};

		if (!title.trim()) {
			errors.title = 'Title is required';
		}

		if (!secretMessageContent.trim()) {
			errors.secretMessageContent = 'Secret message is required';
		}

		if (recipients.length === 0) {
			errors.recipients = 'At least one recipient is required';
		}

		for (let i = 0; i < recipients.length; i++) {
			const r = recipients[i];
			if (!r.name.trim()) {
				errors[`recipient_${i}_name`] = 'Name is required';
			}
			if (!r.email.trim()) {
				errors[`recipient_${i}_email`] = 'Email is required';
			} else if (!isValidEmail(r.email)) {
				errors[`recipient_${i}_email`] = 'Invalid email address';
			}
		}

		if (sssSharesTotal < 3) {
			errors.sssSharesTotal = 'Minimum 3 shares required';
		}
		if (sssThreshold < 2) {
			errors.sssThreshold = 'Minimum threshold is 2';
		}
		if (sssThreshold > sssSharesTotal) {
			errors.sssThreshold = 'Threshold cannot exceed total shares';
		}
		if (enableNostrShares && recipients.some((recipient) => !recipient.nostrPubkey.trim())) {
			errors.nostrRecipients = 'Every Nostr recipient requires a valid npub';
		}
		if (enableNostrShares && recipients.length > sssSharesTotal - 1) {
			errors.nostrRecipients = 'Increase total shares so each recipient has a distinct share';
		}

		fieldErrors = errors;
		return Object.keys(errors).length === 0;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		isSubmitting = true;

		try {
			if (!validate()) {
				isSubmitting = false;
				return;
			}

			// SSS split client-side
			const secretBuffer = Buffer.from(secretMessageContent, 'utf8');
			const shares = sss.split(secretBuffer, {
				shares: sssSharesTotal,
				threshold: sssThreshold
			});

			if (shares.length < sssSharesTotal || shares.length === 0) {
				throw new Error('Failed to generate the required number of SSS shares.');
			}

			const userManagedShares: string[] = [];
			for (let i = 1; i < shares.length; i++) {
				userManagedShares.push(shares[i].toString('hex'));
			}

			const serverSharePlainHex = shares[0].toString('hex');

			// Get CSRF token
			const csrfRes = await fetch('/api/csrf-token');
			const { token: csrfToken } = await csrfRes.json();

			const payload = buildSecretCreationPayload({
				title,
				serverShare: serverSharePlainHex,
				recipients,
				checkInDays: parseInt(checkInDays, 10),
				totalShares: sssSharesTotal,
				threshold: sssThreshold,
				enableNostrShares,
				enableBitcoinTimelock
			});

			const response = await fetch('/api/secrets', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-csrf-token': csrfToken
				},
				body: JSON.stringify(payload)
			});

			const result = await response.json();

			if (!response.ok) throw new Error(result.error || 'Failed to create secret via API');
			if (!result.secretId) throw new Error('API did not return a secret ID.');

			if (result.warning) {
				error = result.warning;
			}

			// Plaintext owner/recipient shares live only in this tab's memory until
			// the owner downloads an encrypted recovery kit or leaves the flow.
			setEphemeralRecoveryState({
				secretId: result.secretId,
				shares: userManagedShares,
				createdAt: Date.now()
			});

			// Publish recipient shares entirely in this browser. Only signed outer
			// events and public signed manifests are sent back to KeyFate.
			if (enableNostrShares) {
				try {
					const nostrRecipients = result.recipients as Array<{
						id: string;
						nostrPubkey: string | null;
					}>;
					if (nostrRecipients.some((recipient) => !recipient.nostrPubkey)) {
						throw new Error('Server did not persist every recipient npub');
					}

					const { recipientShares } = partitionRecoveryShares(
						userManagedShares,
						nostrRecipients.length
					);
					const publication = await publishSharesToNostr({
						secretId: result.secretId,
						shares: nostrRecipients.map((recipient, index) => ({
							recipientId: recipient.id,
							share: recipientShares[index],
							shareIndex: index + 1
						})),
						recipients: nostrRecipients.map((recipient) => ({
							id: recipient.id,
							nostrPubkey: recipient.nostrPubkey
						})),
						senderSecretKey: generateSecretKey(),
						threshold: sssThreshold,
						totalShares: sssSharesTotal
					});

					if (
						publication.errors.length > 0 ||
						publication.published.length !== nostrRecipients.length
					) {
						throw new Error(
							publication.errors[0]?.error || 'Not every recipient artifact reached a relay'
						);
					}

					const registerResponse = await fetch(`/api/secrets/${result.secretId}/publish-nostr`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'x-csrf-token': csrfToken
						},
						body: JSON.stringify(buildNostrRegistrationPayload(publication.published))
					});
					if (!registerResponse.ok) {
						const registration = await registerResponse.json();
						throw new Error(registration.error || 'Failed to register Nostr recovery artifacts');
					}

					setEphemeralNostrMetadata(result.secretId, {
						eventIds: publication.published.map((item) => item.nostrEventId),
						manifests: publication.published.map((item) => item.manifestEvent)
					});
				} catch (nostrError) {
					clearEphemeralRecoveryState(result.secretId);
					await fetch(`/api/secrets/${result.secretId}`, {
						method: 'DELETE',
						headers: { 'x-csrf-token': csrfToken }
					}).catch(() => undefined);
					throw nostrError;
				}
			}

			const queryParams = new URLSearchParams({
				secretId: result.secretId,
				sss_shares_total: sssSharesTotal.toString(),
				sss_threshold: sssThreshold.toString(),
				recipients: encodeURIComponent(
					JSON.stringify(recipients.map((r) => ({ name: r.name, email: r.email })))
				)
			});

			goto(`/secrets/${result.secretId}/share-instructions?${queryParams.toString()}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unknown error occurred.';
			console.error('Submit error:', err);
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if error}
	<Alert.Root variant="destructive" class="mb-6">
		<AlertCircle class="h-4 w-4" />
		<Alert.Title>Error Creating Secret</Alert.Title>
		<Alert.Description>{error}</Alert.Description>
	</Alert.Root>
{/if}

{#if isAtLimit}
	<Alert.Root variant="destructive" class="mb-6">
		<AlertCircle class="h-4 w-4" />
		<Alert.Title>Secret Limit Reached</Alert.Title>
		<Alert.Description>
			You've used all {tierInfo?.secretsLimit} of your {isPaid ? 'Pro' : 'Free'} tier secrets.
			{#if !isPaid}{' '}Upgrade to Pro to create up to 10 secrets.{/if}
		</Alert.Description>
	</Alert.Root>
{/if}

{#if showWarning}
	<Alert.Root class="border-muted bg-muted/50 mb-6">
		<AlertTriangle class="text-muted-foreground h-4 w-4" />
		<Alert.Title class="text-foreground">Approaching Limit</Alert.Title>
		<Alert.Description class="text-muted-foreground">
			You're using {tierInfo?.secretsUsed} of {tierInfo?.secretsLimit} secrets ({Math.round(
				percentageUsed
			)}%).
			{#if !isPaid}{' '}Consider upgrading to Pro for 10 secrets.{/if}
		</Alert.Description>
	</Alert.Root>
{/if}

<form onsubmit={handleSubmit} class="space-y-8">
	<!-- Secret Details -->
	<div class="space-y-4">
		<div class="space-y-2">
			<Label for="title" class="text-muted-foreground text-xs font-medium">Secret Title</Label>
			<Input
				id="title"
				bind:value={title}
				placeholder="Example: Grandma's Recipe Book Location"
				disabled={isSubmitting}
			/>
			{#if fieldErrors.title}
				<p class="text-destructive text-xs">{fieldErrors.title}</p>
			{/if}
		</div>

		<div class="space-y-2">
			<Label
				for="secretMessage"
				class="text-muted-foreground flex items-center gap-1 text-xs font-medium"
			>
				Secret Message
				<Lock class="h-3 w-3" />
			</Label>
			<Textarea
				id="secretMessage"
				bind:value={secretMessageContent}
				placeholder="Your secret message."
				rows={4}
				disabled={isSubmitting}
			/>
			<div class="flex items-center justify-between">
				<p class="text-muted-foreground text-xs">
					This message will be split using Shamir's Secret Sharing. You'll manage the shares on the
					next page.
				</p>
			</div>
			{#if fieldErrors.secretMessageContent}
				<p class="text-destructive text-xs">{fieldErrors.secretMessageContent}</p>
			{/if}
			<MessageTemplateSelector
				onSelectTemplate={handleTemplateSelect}
				isPro={isPaid}
				onUpgradeClick={() => (showUpgradeModal = true)}
			/>
		</div>
	</div>

	<!-- Recipients -->
	<div class="space-y-4 pt-8">
		<div class="flex items-center justify-between">
			<h2 class="font-space text-lg font-bold tracking-tight">Recipients</h2>
			{#if !isPaid && recipients.length >= 1}
				<Button
					type="button"
					variant="outline"
					size="sm"
					onclick={() => (showUpgradeModal = true)}
					class="h-8 gap-1.5 text-xs"
				>
					<Crown class="h-3 w-3" />
					Add More (Pro)
				</Button>
			{/if}
		</div>

		{#if fieldErrors.recipients}
			<p class="text-destructive text-xs">{fieldErrors.recipients}</p>
		{/if}

		{#if isPaid && maxRecipients > 0 && recipients.length >= Math.floor(maxRecipients * 0.75)}
			<Alert.Root class="border-muted bg-muted/50">
				<AlertTriangle class="text-muted-foreground h-4 w-4" />
				<Alert.Description class="text-muted-foreground text-sm">
					{recipients.length >= maxRecipients
						? `Maximum ${maxRecipients} recipients reached.`
						: `Using ${recipients.length} of ${maxRecipients} recipients.`}
				</Alert.Description>
			</Alert.Root>
		{/if}

		<div class="space-y-3">
			{#each recipients as recipient, index}
				<div class="border-border/50 space-y-3 rounded-md border p-4">
					<div class="flex items-center justify-between">
						<div class="text-muted-foreground text-xs font-medium">Recipient {index + 1}</div>
						{#if recipients.length > 1}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onclick={() => removeRecipient(index)}
								disabled={isSubmitting}
								class="h-7 w-7 p-0"
							>
								<Trash2 class="h-3.5 w-3.5" />
							</Button>
						{/if}
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<Label for="recipient-{index}-name" class="text-muted-foreground text-xs font-medium"
								>Name</Label
							>
							<Input
								id="recipient-{index}-name"
								bind:value={recipient.name}
								placeholder="Jane Doe"
								disabled={isSubmitting}
								class="h-9"
							/>
							{#if fieldErrors[`recipient_${index}_name`]}
								<p class="text-destructive text-xs">{fieldErrors[`recipient_${index}_name`]}</p>
							{/if}
						</div>
						<div class="space-y-1">
							<Label for="recipient-{index}-email" class="text-muted-foreground text-xs font-medium"
								>Email</Label
							>
							<Input
								id="recipient-{index}-email"
								type="email"
								bind:value={recipient.email}
								placeholder="recipient@example.com"
								disabled={isSubmitting}
								class="h-9"
							/>
							{#if fieldErrors[`recipient_${index}_email`]}
								<p class="text-destructive text-xs">{fieldErrors[`recipient_${index}_email`]}</p>
							{/if}
						</div>
					</div>
				</div>
			{/each}

			{#if isPaid && canAddMore}
				<Button
					type="button"
					variant="outline"
					onclick={addRecipient}
					disabled={isSubmitting}
					class="h-9 w-full text-sm"
				>
					<Plus class="mr-1.5 h-4 w-4" />
					Add Recipient ({recipients.length} / {maxRecipients})
				</Button>
			{/if}

			{#if isPaid && !canAddMore}
				<div class="text-muted-foreground py-1.5 text-center text-xs">
					Maximum {maxRecipients} recipients reached
				</div>
			{/if}
		</div>
	</div>

	<!-- Check-in Settings -->
	<div class="space-y-4 pt-8">
		<h2 class="font-space text-lg font-bold tracking-tight">Check-in Settings</h2>
		<div class="space-y-2">
			<Label for="checkInDays" class="text-muted-foreground text-xs font-medium"
				>Trigger Deadline</Label
			>
			<Select.Root type="single" bind:value={checkInDays}>
				<Select.Trigger>
					<span>{selectedCheckInLabel}</span>
				</Select.Trigger>
				<Select.Content>
					{#each availableOptions as option}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<p class="text-muted-foreground text-xs">
				{isPaid
					? 'How long until your secret is automatically disclosed. Checking in will start the timer over.'
					: 'How long until your secret is automatically disclosed. Upgrade to Pro for more interval options.'}
			</p>
		</div>
	</div>

	<!-- Bitcoin & Nostr Settings (Pro) -->
	{#if isPaid}
		<div class="space-y-4 pt-8">
			<Accordion.Root type="single">
				<Accordion.Item value="bitcoin-nostr" class="border-0">
					<Accordion.Trigger
						class="text-muted-foreground hover:text-foreground py-0 text-sm font-medium hover:no-underline"
					>
						<span class="flex items-center gap-1.5">
							<Bitcoin class="h-3.5 w-3.5" />
							Bitcoin & Nostr (optional)
						</span>
					</Accordion.Trigger>
					<Accordion.Content class="space-y-4 pt-4">
						<Alert.Root>
							<Info class="h-4 w-4" />
							<Alert.Description class="text-xs">
								These features are optional and can be configured later from the secret detail page.
							</Alert.Description>
						</Alert.Root>

						<!-- Nostr share publishing toggle -->
						<div class="flex items-start gap-3 rounded-md border p-3">
							<Checkbox
								id="enable-nostr"
								bind:checked={enableNostrShares}
								disabled={isSubmitting}
							/>
							<div class="space-y-1">
								<Label for="enable-nostr" class="flex items-center gap-1.5 text-sm font-medium">
									<Radio class="h-3.5 w-3.5" />
									Enable Nostr Share Publishing
								</Label>
								<p class="text-muted-foreground text-xs">
									Deliver encrypted shares to recipients via Nostr direct messages (NIP-17).
								</p>
							</div>
						</div>

						{#if enableNostrShares}
							<div class="space-y-3 pl-6">
								{#each recipients as recipient, index}
									<div class="bg-muted/30 rounded-md border p-3">
										<p class="text-muted-foreground mb-2 text-xs font-medium">
											{recipient.name || `Recipient ${index + 1}`} — Nostr Pubkey
										</p>
										<NostrPubkeyInput bind:value={recipient.nostrPubkey} />
									</div>
								{/each}
								{#if fieldErrors.nostrRecipients}
									<p class="text-destructive text-xs">{fieldErrors.nostrRecipients}</p>
								{/if}
							</div>
						{/if}

						<!-- Bitcoin timelock toggle -->
						<div class="flex items-start gap-3 rounded-md border p-3">
							<Checkbox id="enable-bitcoin" checked={false} disabled={true} />
							<div class="space-y-1">
								<Label for="enable-bitcoin" class="flex items-center gap-1.5 text-sm font-medium">
									<Bitcoin class="h-3.5 w-3.5" />
									Bitcoin Timelock (Staging Gate)
								</Label>
								<p class="text-muted-foreground text-xs">
									Recipient-encrypted transaction support is implemented, but enrollment remains
									disabled until the credentialed signet funding, refresh, and broadcast gate
									passes.
								</p>
							</div>
						</div>
					</Accordion.Content>
				</Accordion.Item>
			</Accordion.Root>
		</div>
	{/if}

	<!-- Advanced Settings -->
	<div class="space-y-4 pt-8">
		<Accordion.Root type="single" value={recipients.length > 1 ? 'sss-config' : undefined}>
			<Accordion.Item value="sss-config" class="border-0">
				<Accordion.Trigger
					class="text-muted-foreground hover:text-foreground py-0 text-sm font-medium hover:no-underline"
				>
					Advanced Settings (optional)
				</Accordion.Trigger>
				<Accordion.Content class="space-y-3 pt-4">
					{#if recipients.length > 1}
						<Alert.Root>
							<Info class="h-4 w-4" />
							<Alert.Title class="text-sm">Multiple Recipients</Alert.Title>
							<Alert.Description class="text-xs">
								All recipients will receive the SAME share. You must distribute this share to each
								recipient separately via your own secure channels. With multiple recipients,
								consider your threshold carefully.
							</Alert.Description>
						</Alert.Root>
					{/if}
					<Alert.Root>
						<Info class="h-4 w-4" />
						<Alert.Title class="text-sm">Secret Sharing Details</Alert.Title>
						<Alert.Description class="text-xs">
							<ul class="list-disc space-y-0.5 pl-5">
								<li>Your secret message will be split into a number of cryptographic "shares".</li>
								<li>
									A minimum number of shares (threshold) will be required to reconstruct the
									original message.
								</li>
								<li>
									KeyFate will securely store one share (encrypted again by our server). You will
									manage the others on the next page.
								</li>
							</ul>
						</Alert.Description>
					</Alert.Root>
					<ThresholdSelector
						bind:sharesTotalValue={sssSharesTotal}
						bind:thresholdValue={sssThreshold}
						isPro={isPaid}
						{isSubmitting}
						onUpgradeClick={() => (showUpgradeModal = true)}
						sharesTotalError={fieldErrors.sssSharesTotal}
						thresholdError={fieldErrors.sssThreshold}
					/>
				</Accordion.Content>
			</Accordion.Item>
		</Accordion.Root>
	</div>

	<Button type="submit" disabled={isSubmitting || !!isAtLimit} class="w-full font-semibold">
		{isSubmitting
			? 'Processing & Encrypting...'
			: isAtLimit
				? 'Secret Limit Reached - Upgrade Required'
				: 'Create Secret & Proceed to Share Management'}
	</Button>
</form>

<UpgradeModal
	bind:open={showUpgradeModal}
	onOpenChange={(v) => (showUpgradeModal = v)}
	feature="multiple recipients per secret"
	currentLimit="1 recipient"
	proLimit="Up to 5 recipients"
/>
