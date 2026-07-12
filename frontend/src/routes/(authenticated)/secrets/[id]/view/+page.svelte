<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import DataLabel from '$lib/components/DataLabel.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import Keyline from '$lib/components/Keyline.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Table from '$lib/components/ui/table';
	import { formatGranularTime } from '$lib/time-utils';
	import BitcoinStatus from '$lib/components/BitcoinStatus.svelte';
	import {
		AlertCircle,
		ArrowLeft,
		Calendar,
		CheckCircle,
		Download,
		History,
		Loader2,
		Mail,
		Pause,
		Pencil,
		Phone,
		Play,
		Send,
		Trash2
	} from '@lucide/svelte';

	let { data } = $props();

	let checkInLoading = $state(false);
	let pauseLoading = $state(false);
	let deleteLoading = $state(false);
	let sendNowLoading = $state(false);
	let showDeleteModal = $state(false);
	let showSendNowModal = $state(false);
	let actionError = $state<string | null>(null);

	let isTriggered = $derived(
		data.secret.triggeredAt !== null || data.secret.status === 'triggered'
	);
	let serverShareDeleted = $derived(!data.secret.serverShare);
	let isFailed = $derived(data.secret.status === 'failed');
	let isOverdue = $derived(
		data.secret.status === 'active' &&
			!isTriggered &&
			!serverShareDeleted &&
			data.secret.nextCheckIn !== null &&
			new Date(data.secret.nextCheckIn).getTime() < Date.now()
	);
	let isInactive = $derived(isTriggered || isFailed || serverShareDeleted);
	let isRecoverable = $derived(isFailed && !data.hasBeenDisclosed && !!data.secret.serverShare);

	let statusLabel = $derived.by(() => {
		if (isTriggered) return 'sent';
		if (isFailed) return 'failed';
		if (serverShareDeleted) return 'disabled';
		if (data.secret.status === 'paused') return 'paused';
		if (isOverdue) return 'overdue';
		if (data.secret.status === 'active') return 'active';
		return 'unknown';
	});

	let statusColorClass = $derived.by(() => {
		if (isTriggered) return 'border-muted-foreground/50 text-muted-foreground';
		if (isFailed) return 'border-destructive/50 bg-destructive/10 text-destructive';
		if (serverShareDeleted) return 'border-muted-foreground/50 text-muted-foreground';
		if (data.secret.status === 'paused') return 'border-warning/50 bg-warning/10 text-warning';
		if (isOverdue) return 'border-destructive/50 bg-destructive/10 text-destructive';
		if (data.secret.status === 'active') return 'border-success/50 bg-success/10 text-success';
		return 'border-muted-foreground/50 text-muted-foreground';
	});

	let countdownText = $derived.by(() => {
		if (isTriggered) return 'Sent';
		if (isFailed) return 'Failed';
		if (serverShareDeleted) return '—';
		if (data.secret.status === 'paused') return 'Paused';
		if (isOverdue) return 'Overdue';
		return formatGranularTime(data.secret.nextCheckIn || new Date().toISOString());
	});

	let keylineProgress = $derived.by(() => {
		if (isInactive || data.secret.status === 'paused') return 0;
		if (isOverdue) return 100;
		const now = new Date();
		const nextCheckIn = data.secret.nextCheckIn ? new Date(data.secret.nextCheckIn) : now;
		const intervalMs = data.secret.checkInDays * 24 * 60 * 60 * 1000;
		const startMs = nextCheckIn.getTime() - intervalMs;
		const elapsed = now.getTime() - startMs;
		return Math.max(0, Math.min(100, (elapsed / intervalMs) * 100));
	});

	let canCheckIn = $derived.by(() => {
		// Recoverable failed secrets can always check in
		if (isRecoverable) return true;
		if (isInactive || data.secret.status === 'paused' || isOverdue) return false;
		if (!data.secret.lastCheckIn) return true;
		const lastCheckIn = new Date(data.secret.lastCheckIn);
		const fifteenMinutesAgo = new Date();
		fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
		return lastCheckIn < fifteenMinutesAgo;
	});

	let serverShareStatus = $derived(
		data.secret.serverShare ? 'Stored securely' : 'Deleted / not available'
	);

	async function handleCheckIn() {
		checkInLoading = true;
		actionError = null;
		try {
			// Bitcoin continuity refresh is a separate fail-closed workflow. A
			// regular check-in never assumes session-resident private keys.
			const csrfRes = await fetch('/api/csrf-token');
			const { token: csrfToken } = await csrfRes.json();

			const response = await fetch(`/api/secrets/${data.secret.id}/check-in`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-csrf-token': csrfToken
				}
			});

			if (!response.ok) {
				const errData = await response.json();
				throw new Error(errData.error || 'Failed to check in');
			}

			await invalidateAll();
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Failed to check in';
		} finally {
			checkInLoading = false;
		}
	}

	async function handleTogglePause() {
		pauseLoading = true;
		actionError = null;
		try {
			const csrfRes = await fetch('/api/csrf-token');
			const { token: csrfToken } = await csrfRes.json();

			const response = await fetch(`/api/secrets/${data.secret.id}/toggle-pause`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-csrf-token': csrfToken
				}
			});

			if (!response.ok) {
				const errData = await response.json();
				throw new Error(errData.error || 'Failed to toggle pause');
			}

			await invalidateAll();
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Failed to toggle pause';
		} finally {
			pauseLoading = false;
		}
	}

	async function handleDelete() {
		deleteLoading = true;
		actionError = null;
		try {
			const csrfRes = await fetch('/api/csrf-token');
			const { token: csrfToken } = await csrfRes.json();

			const response = await fetch(`/api/secrets/${data.secret.id}`, {
				method: 'DELETE',
				headers: { 'x-csrf-token': csrfToken }
			});

			if (!response.ok) {
				const errData = await response.json();
				throw new Error(errData.error || 'Failed to delete secret');
			}

			showDeleteModal = false;
			goto('/dashboard');
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Failed to delete secret';
			showDeleteModal = false;
		} finally {
			deleteLoading = false;
		}
	}

	async function handleSendNow() {
		sendNowLoading = true;
		actionError = null;
		try {
			const csrfRes = await fetch('/api/csrf-token');
			const { token: csrfToken } = await csrfRes.json();

			const response = await fetch(`/api/secrets/${data.secret.id}/send-now`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-csrf-token': csrfToken
				}
			});

			if (!response.ok) {
				const errData = await response.json();
				throw new Error(errData.error || 'Failed to send secret');
			}

			showSendNowModal = false;
			await invalidateAll();
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Failed to send secret';
			showSendNowModal = false;
		} finally {
			sendNowLoading = false;
		}
	}
</script>

<svelte:head>
	<title>{data.secret.title} - KeyFate</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-6 py-12">
	<!-- Back link -->
	<div class="mb-8">
		<a
			href="/dashboard"
			class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
		>
			<ArrowLeft class="h-4 w-4" />
			Dashboard
		</a>
	</div>

	<!-- Header: title + status -->
	<div class="flex items-start justify-between gap-4">
		<h1 class="font-space text-3xl font-light tracking-tight md:text-4xl">
			{data.secret.title}
		</h1>
		<Badge variant="outline" class="shrink-0 text-xs tracking-wider uppercase {statusColorClass}">
			{statusLabel}
		</Badge>
	</div>

	<!-- Massive countdown -->
	<div
		class="font-space text-foreground mt-4 -ml-1 text-[3.5rem] leading-none font-light tracking-tighter sm:text-[5rem] md:text-[6rem]"
	>
		{countdownText}
	</div>

	<!-- Keyline -->
	{#if !isInactive && data.secret.status !== 'paused'}
		<Keyline progress={keylineProgress} />
	{:else}
		<div class="bg-muted my-8 h-[2px] w-full"></div>
	{/if}

	<!-- Actions bar — consolidated at the top, logically grouped -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<!-- Primary actions -->
		<div class="flex flex-wrap items-center gap-2">
			{#if isRecoverable}
				<!-- Recovery actions for failed secrets that haven't been disclosed -->
				<Button
					variant="default"
					onclick={handleCheckIn}
					disabled={checkInLoading}
					class="text-sm font-semibold"
				>
					{#if checkInLoading}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Recovering...
					{:else}
						<CheckCircle class="mr-2 h-4 w-4" />
						Check In
					{/if}
				</Button>
				<Button
					variant="outline"
					onclick={() => (showSendNowModal = true)}
					disabled={sendNowLoading}
					class="text-sm font-semibold"
				>
					<Send class="mr-2 h-4 w-4" />
					Send Now
				</Button>
			{:else if isFailed && !isRecoverable}
				<!-- Failed and already disclosed — no recovery possible -->
				<p class="text-muted-foreground text-sm">
					This secret has already been disclosed to recipients.
				</p>
			{:else if !isInactive}
				{#if canCheckIn}
					<Button
						variant="default"
						onclick={handleCheckIn}
						disabled={checkInLoading}
						class="text-sm font-semibold"
					>
						{#if checkInLoading}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Checking in...
						{:else}
							<CheckCircle class="mr-2 h-4 w-4" />
							Check In
						{/if}
					</Button>
				{/if}

				{#if !isOverdue && (data.secret.status === 'active' || data.secret.status === 'paused')}
					<Button
						variant="outline"
						onclick={handleTogglePause}
						disabled={pauseLoading}
						class="text-sm font-semibold"
					>
						{#if data.secret.status === 'paused'}
							<Play class="mr-2 h-4 w-4" />
							{pauseLoading ? 'Resuming...' : 'Resume'}
						{:else}
							<Pause class="mr-2 h-4 w-4" />
							{pauseLoading ? 'Pausing...' : 'Pause'}
						{/if}
					</Button>
				{/if}

				<Button
					variant="outline"
					size="default"
					href={`/secrets/${data.secret.id}/edit`}
					class="text-sm font-semibold"
				>
					<Pencil class="mr-2 h-4 w-4" />
					Edit
				</Button>
			{/if}
		</div>

		<!-- Secondary actions -->
		<div class="flex flex-wrap items-center gap-2">
			{#if !isTriggered}
				<Button
					variant="ghost"
					onclick={() => (showDeleteModal = true)}
					disabled={deleteLoading}
					class="text-destructive hover:text-destructive text-sm font-semibold"
				>
					<Trash2 class="mr-2 h-4 w-4" />
					Delete
				</Button>
			{/if}
		</div>
	</div>

	{#if actionError}
		<div class="border-destructive/50 bg-destructive/10 mt-6 rounded-lg border p-4">
			<div class="flex items-center gap-2">
				<AlertCircle class="text-destructive h-4 w-4 shrink-0" />
				<p class="text-destructive text-sm">{actionError}</p>
			</div>
		</div>
	{/if}

	<!-- Details section -->
	<div class="mt-16 space-y-16">
		<!-- Secret metadata — single consolidated section -->
		<section>
			<h2 class="font-space mb-8 text-xl font-semibold tracking-tight">Details</h2>

			<div class="grid grid-cols-2 gap-x-12 gap-y-8 md:grid-cols-4">
				<DataLabel label="Status">
					<Badge variant="outline" class="text-xs tracking-wider uppercase {statusColorClass}">
						{statusLabel}
					</Badge>
				</DataLabel>

				<DataLabel label="Check-in Interval" value="{data.secret.checkInDays} days" />

				{#if data.secret.nextCheckIn}
					<DataLabel label="Next Check-in">
						{new Date(data.secret.nextCheckIn).toLocaleDateString(undefined, {
							month: 'short',
							day: 'numeric',
							year: 'numeric'
						})}
					</DataLabel>
				{/if}

				{#if data.secret.lastCheckIn}
					<DataLabel label="Last Check-in">
						{new Date(data.secret.lastCheckIn).toLocaleDateString(undefined, {
							month: 'short',
							day: 'numeric',
							year: 'numeric'
						})}
					</DataLabel>
				{/if}

				<DataLabel label="Server Share" value={serverShareStatus} />

				<DataLabel label="Created">
					{new Date(data.secret.createdAt).toLocaleDateString(undefined, {
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					})}
				</DataLabel>

				<DataLabel
					label="Shares"
					value="{data.secret.sssThreshold} of {data.secret.sssSharesTotal} required"
				/>
			</div>
		</section>

		<!-- Recipients -->
		<section>
			<h2 class="font-space mb-8 text-xl font-semibold tracking-tight">
				Recipients ({data.secret.recipients.length})
			</h2>

			<div class="space-y-4">
				{#each data.secret.recipients as recipient (recipient.id)}
					<div class="flex items-center gap-4 text-sm">
						<span class="text-foreground font-medium">{recipient.name}</span>
						{#if recipient.email}
							<span class="text-muted-foreground flex items-center gap-1.5">
								<Mail class="h-3.5 w-3.5" />
								{recipient.email}
							</span>
						{/if}
						{#if recipient.phone}
							<span class="text-muted-foreground flex items-center gap-1.5">
								<Phone class="h-3.5 w-3.5" />
								{recipient.phone}
							</span>
						{/if}
					</div>
				{/each}
			</div>
		</section>

		<!-- Bitcoin Timelock -->
		<section>
			<BitcoinStatus secretId={data.secret.id} />
		</section>

		<!-- Check-in History -->
		<section>
			<h2 class="font-space mb-8 text-xl font-semibold tracking-tight">Check-in History</h2>
			{#if data.checkInHistory.length > 0}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="text-muted-foreground text-xs">Check-in Date</Table.Head>
							<Table.Head class="text-muted-foreground text-xs">Next Check-in</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.checkInHistory as checkIn, index (index)}
							<Table.Row>
								<Table.Cell>
									<div class="flex items-center gap-2">
										<CheckCircle class="text-accent-foreground h-4 w-4" />
										{new Date(checkIn.checkedInAt).toLocaleDateString(undefined, {
											month: 'short',
											day: 'numeric',
											year: 'numeric'
										})} at {new Date(checkIn.checkedInAt).toLocaleTimeString(undefined, {
											hour: '2-digit',
											minute: '2-digit'
										})}
									</div>
								</Table.Cell>
								<Table.Cell>
									<div class="flex items-center gap-2">
										<Calendar class="text-muted-foreground h-4 w-4" />
										{new Date(checkIn.nextCheckIn).toLocaleDateString(undefined, {
											month: 'short',
											day: 'numeric',
											year: 'numeric'
										})}
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{:else}
				<div class="py-8 text-center">
					<History class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
					<p class="text-muted-foreground text-sm">No check-in history available.</p>
				</div>
			{/if}
		</section>
	</div>
</div>

<ConfirmDialog
	bind:open={showDeleteModal}
	onOpenChange={(v: boolean) => (showDeleteModal = v)}
	onConfirm={handleDelete}
	title="Delete Secret"
	description="Are you sure you want to delete this secret? This action cannot be undone and the secret will be permanently removed."
	confirmText="Delete Secret"
	loadingText="Deleting..."
	loading={deleteLoading}
/>

<ConfirmDialog
	bind:open={showSendNowModal}
	onOpenChange={(v: boolean) => (showSendNowModal = v)}
	onConfirm={handleSendNow}
	title="Send Secret Now"
	description="This will immediately send the secret to all recipients. This action cannot be undone — once disclosed, the secret cannot be recovered."
	confirmText="Send Now"
	loadingText="Sending..."
	loading={sendNowLoading}
/>
