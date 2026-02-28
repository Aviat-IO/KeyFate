<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import DeleteConfirm from '$lib/components/DeleteConfirm.svelte';
	import ExportRecoveryKitButton from '$lib/components/ExportRecoveryKitButton.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
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

<div class="mx-auto max-w-4xl py-8 sm:px-4">
	<!-- Header -->
	<div class="mb-6 flex items-center gap-4">
		<a href="/dashboard">
			<Button variant="ghost" size="icon">
				<ArrowLeft class="h-4 w-4" />
			</Button>
		</a>
		<div class="flex-1">
			<h1 class="flex items-center gap-2 text-3xl font-bold">
				<FileText class="text-primary h-8 w-8" />
				{data.secret.title}
			</h1>
			<p class="text-muted-foreground">Secret Details</p>
		</div>
		<a href="/secrets/{data.secret.id}/edit">
			<Button variant="outline" size="sm">
				<Edit class="mr-2 h-4 w-4" />
				Edit
			</Button>
		</a>
	</div>

	{#if actionError}
		<div class="border-destructive/50 bg-destructive/10 mb-6 rounded-lg border p-4">
			<div class="flex items-center gap-2">
				<AlertCircle class="text-destructive h-4 w-4" />
				<p class="text-destructive text-sm">{actionError}</p>
			</div>
		</div>
	{/if}

	<div class="grid gap-6">
		<!-- Secret Information -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Shield class="h-5 w-5" />
					Secret Information
				</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-4">
					<div class="flex items-start gap-3">
						<User class="text-muted-foreground mt-0.5 h-4 w-4" />
						<div class="flex-1">
							<p class="mb-2 text-sm font-medium">
								Recipients ({data.secret.recipients.length})
							</p>
							<div class="space-y-2">
								{#each data.secret.recipients as recipient (recipient.id)}
									<div class="flex items-center gap-2 text-sm">
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

					<div class="flex items-start gap-3">
						<Shield class="text-muted-foreground mt-0.5 h-4 w-4" />
						<div>
							<p class="text-sm font-medium">Server Share</p>
							<p class="text-muted-foreground text-sm">{serverShareStatus}</p>
						</div>
					</div>

					<div class="flex items-start gap-3">
						<Calendar class="text-muted-foreground mt-0.5 h-4 w-4" />
						<div>
							<p class="text-sm font-medium">Created</p>
							<p class="text-muted-foreground text-sm">
								{new Date(data.secret.createdAt).toLocaleDateString()}
							</p>
						</div>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Status and Settings -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Clock class="h-5 w-5" />
					Status & Settings
				</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="flex items-start gap-3">
						<statusInfo.icon class="mt-0.5 h-4 w-4" />
						<div>
							<p class="text-sm font-medium">Status</p>
							<Badge variant="secondary" class={statusInfo.colorClass}>
								{statusInfo.label}
							</Badge>
						</div>
					</div>

					<div class="flex items-start gap-3">
						<Calendar class="text-muted-foreground mt-0.5 h-4 w-4" />
						<div>
							<p class="text-sm font-medium">Check-in Interval</p>
							<p class="text-muted-foreground text-sm">{data.secret.checkInDays} days</p>
						</div>
					</div>

					{#if data.secret.nextCheckIn}
						<div class="flex items-start gap-3">
							<Clock class="text-muted-foreground mt-0.5 h-4 w-4" />
							<div>
								<p class="text-sm font-medium">Next Check-in</p>
								<p class="text-muted-foreground text-sm">
									{new Date(data.secret.nextCheckIn).toLocaleDateString()} at {new Date(
										data.secret.nextCheckIn
									).toLocaleTimeString()}
								</p>
							</div>
						</div>
					{/if}

					{#if data.secret.lastCheckIn}
						<div class="flex items-start gap-3">
							<CheckCircle class="text-muted-foreground mt-0.5 h-4 w-4" />
							<div>
								<p class="text-sm font-medium">Last Check-in</p>
								<p class="text-muted-foreground text-sm">
									{new Date(data.secret.lastCheckIn).toLocaleDateString()} at {new Date(
										data.secret.lastCheckIn
									).toLocaleTimeString()}
								</p>
							</div>
						</div>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Actions -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Download class="h-5 w-5" />
					Actions
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-wrap gap-4">
					{#if data.secret.status !== 'triggered'}
						<Button
							onclick={handleCheckIn}
							disabled={checkInLoading || data.secret.status === 'paused'}
						>
							<CheckCircle class="mr-2 h-4 w-4" />
							{checkInLoading ? 'Checking in...' : 'Check In'}
						</Button>

						<Button
							variant="outline"
							onclick={handleTogglePause}
							disabled={pauseLoading}
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
					>
						<Trash2 class="mr-2 h-4 w-4" />
						Delete
					</Button>
				</div>
				<p class="text-muted-foreground mt-4 text-sm">
					Export a recovery kit to ensure your secret remains accessible even if KeyFate is
					unavailable.
				</p>
			</Card.Content>
		</Card.Root>

		<!-- Check-in History -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<History class="h-5 w-5" />
					Check-in History
				</Card.Title>
			</Card.Header>
			<Card.Content>
				{#if data.checkInHistory.length > 0}
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Check-in Date</Table.Head>
								<Table.Head>Next Check-in Date</Table.Head>
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
			</Card.Content>
		</Card.Root>
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
