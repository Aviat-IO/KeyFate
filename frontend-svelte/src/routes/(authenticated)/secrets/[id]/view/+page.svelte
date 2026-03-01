<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import DeleteConfirm from '$lib/components/DeleteConfirm.svelte';
	import ExportRecoveryKitButton from '$lib/components/ExportRecoveryKitButton.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Table from '$lib/components/ui/table';
	import {
		AlertCircle,
		ArrowLeft,
		Calendar,
		CheckCircle,
		Clock,
		Download,
		Edit,
		FileText,
		History,
		Mail,
		Pause,
		Phone,
		Play,
		Shield,
		Trash2,
		User
	} from '@lucide/svelte';

	let { data } = $props();

	let checkInLoading = $state(false);
	let pauseLoading = $state(false);
	let deleteLoading = $state(false);
	let showDeleteModal = $state(false);
	let actionError = $state<string | null>(null);

	let statusInfo = $derived.by(() => {
		const secret = data.secret;
		if (secret.triggeredAt || secret.status === 'triggered') {
			return {
				icon: AlertCircle,
				colorClass: 'bg-destructive/10 text-destructive',
				label: 'sent'
			};
		}
		switch (secret.status) {
			case 'active':
				return {
					icon: CheckCircle,
					colorClass: 'bg-accent text-accent-foreground',
					label: 'active'
				};
			case 'paused':
				return {
					icon: Pause,
					colorClass: 'bg-muted text-muted-foreground',
					label: 'paused'
				};
			default:
				return {
					icon: AlertCircle,
					colorClass: 'bg-muted text-muted-foreground',
					label: 'unknown'
				};
		}
	});

	let serverShareStatus = $derived(
		data.secret.serverShare ? 'Stored securely' : 'Deleted / not available'
	);

	async function handleCheckIn() {
		checkInLoading = true;
		actionError = null;
		try {
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
</script>

<svelte:head>
	<title>{data.secret.title} - KeyFate</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-6 py-12">
	<!-- Header -->
	<div class="mb-12 flex items-center gap-4">
		<a href="/dashboard">
			<Button variant="ghost" size="icon">
				<ArrowLeft class="h-4 w-4" />
			</Button>
		</a>
		<div class="flex-1">
			<h1 class="font-space text-3xl font-light tracking-tight">
				{data.secret.title}
			</h1>
		</div>
		<a href="/secrets/{data.secret.id}/edit">
			<Button variant="outline" size="sm" class="uppercase tracking-wide text-sm font-semibold">
				<Edit class="mr-2 h-4 w-4" />
				Edit
			</Button>
		</a>
	</div>

	{#if actionError}
		<div class="border-destructive/50 bg-destructive/10 mb-12 rounded-lg border p-4">
			<div class="flex items-center gap-2">
				<AlertCircle class="text-destructive h-4 w-4" />
				<p class="text-destructive text-sm">{actionError}</p>
			</div>
		</div>
	{/if}

	<div class="space-y-12">
		<!-- Secret Information -->
		<section>
			<h2 class="font-space text-xl font-bold tracking-tight mb-6">Secret Information</h2>
			<div class="flex flex-col md:flex-row justify-between gap-8">
				<div class="flex-1 space-y-4">
					<div>
						<p class="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
							Recipients ({data.secret.recipients.length})
						</p>
						<div class="space-y-2">
							{#each data.secret.recipients as recipient (recipient.id)}
								<div class="flex items-center gap-2 text-sm text-foreground">
									<span class="font-medium">{recipient.name}</span>
									<span class="text-muted-foreground">&bull;</span>
									{#if recipient.email}
										<span class="text-muted-foreground flex items-center gap-1">
											<Mail class="h-3 w-3" />
											{recipient.email}
										</span>
									{/if}
									{#if recipient.phone}
										<span class="text-muted-foreground flex items-center gap-1">
											<Phone class="h-3 w-3" />
											{recipient.phone}
										</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>

				<div class="flex-1 space-y-4">
					<div>
						<p class="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Server Share</p>
						<p class="text-sm text-foreground">{serverShareStatus}</p>
					</div>

					<div>
						<p class="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Created</p>
						<p class="text-sm text-foreground">
							{new Date(data.secret.createdAt).toLocaleDateString()}
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- Status and Settings -->
		<section>
			<h2 class="font-space text-xl font-bold tracking-tight mb-6">Status & Settings</h2>
			<div class="flex flex-col md:flex-row justify-between gap-8">
				<div class="flex-1 space-y-4">
					<div>
						<p class="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Status</p>
						<Badge variant="outline" class={statusInfo.colorClass}>
							{statusInfo.label}
						</Badge>
					</div>

					<div>
						<p class="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Check-in Interval</p>
						<p class="text-sm text-foreground">{data.secret.checkInDays} days</p>
					</div>
				</div>

				<div class="flex-1 space-y-4">
					{#if data.secret.nextCheckIn}
						<div>
							<p class="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Next Check-in</p>
							<p class="text-sm text-foreground">
								{new Date(data.secret.nextCheckIn).toLocaleDateString()} at {new Date(
									data.secret.nextCheckIn
								).toLocaleTimeString()}
							</p>
						</div>
					{/if}

					{#if data.secret.lastCheckIn}
						<div>
							<p class="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Last Check-in</p>
							<p class="text-sm text-foreground">
								{new Date(data.secret.lastCheckIn).toLocaleDateString()} at {new Date(
									data.secret.lastCheckIn
								).toLocaleTimeString()}
							</p>
						</div>
					{/if}
				</div>
			</div>
		</section>

		<!-- Actions -->
		<section>
			<h2 class="font-space text-xl font-bold tracking-tight mb-6">Actions</h2>
			<div class="flex flex-wrap gap-3">
				{#if data.secret.status !== 'triggered'}
					<Button
						variant="outline"
						onclick={handleCheckIn}
						disabled={checkInLoading || data.secret.status === 'paused'}
						class="uppercase tracking-wide text-sm font-semibold"
					>
						<CheckCircle class="mr-2 h-4 w-4" />
						{checkInLoading ? 'Checking in...' : 'Check In'}
					</Button>

					<Button
						variant="outline"
						onclick={handleTogglePause}
						disabled={pauseLoading}
						class="uppercase tracking-wide text-sm font-semibold"
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

				<ExportRecoveryKitButton
					secret={{
						id: data.secret.id,
						title: data.secret.title,
						checkInDays: data.secret.checkInDays,
						createdAt: data.secret.createdAt,
						recipients: data.secret.recipients.map((r) => ({
							id: r.id,
							name: r.name,
							email: r.email,
							phone: r.phone
						}))
					}}
					threshold={data.secret.sssThreshold}
					totalShares={data.secret.sssSharesTotal}
				/>

				<Button
					variant="destructive"
					onclick={() => (showDeleteModal = true)}
					disabled={deleteLoading}
					class="uppercase tracking-wide text-sm font-semibold"
				>
					<Trash2 class="mr-2 h-4 w-4" />
					Delete
				</Button>
			</div>
			<p class="text-muted-foreground mt-4 text-sm">
				Export a recovery kit to ensure your secret remains accessible even if KeyFate is
				unavailable.
			</p>
		</section>

		<!-- Check-in History -->
		<section>
			<h2 class="font-space text-xl font-bold tracking-tight mb-6">Check-in History</h2>
			{#if data.checkInHistory.length > 0}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="text-xs text-muted-foreground uppercase tracking-wider">Check-in Date</Table.Head>
							<Table.Head class="text-xs text-muted-foreground uppercase tracking-wider">Next Check-in Date</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.checkInHistory as checkIn, index (index)}
							<Table.Row>
								<Table.Cell>
									<div class="flex items-center gap-2">
										<CheckCircle class="text-accent-foreground h-4 w-4" />
										{new Date(checkIn.checkedInAt).toLocaleDateString()} at {new Date(
											checkIn.checkedInAt
										).toLocaleTimeString()}
									</div>
								</Table.Cell>
								<Table.Cell>
									<div class="flex items-center gap-2">
										<Calendar class="text-muted-foreground h-4 w-4" />
										{new Date(checkIn.nextCheckIn).toLocaleDateString()}
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{:else}
				<div class="py-8 text-center">
					<History class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
					<p class="text-muted-foreground">No check-in history available.</p>
				</div>
			{/if}
		</section>
	</div>
</div>

<DeleteConfirm
	bind:open={showDeleteModal}
	onOpenChange={(v) => (showDeleteModal = v)}
	onConfirm={handleDelete}
	title="Delete Secret"
	description="Are you sure you want to delete this secret? This action cannot be undone and the secret will be permanently removed."
	confirmText="Delete Secret"
	loading={deleteLoading}
/>
