<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import {
		ArrowLeft,
		AlertCircle,
		CheckCircle,
		Clock,
		Mail,
		Users,
		Lock,
		Activity
	} from '@lucide/svelte';

	let { data } = $props();

	let secretCounts = $derived(data.secretCounts);
	let userCounts = $derived(data.userCounts);
	let emailStats = $derived(data.emailStats);
	let failedSecrets = $derived(data.failedSecrets);
	let emailFailures = $derived(data.emailFailures);
	let cronStats = $derived(data.cronStats);
	let cronEntries = $derived(Object.entries(cronStats));

	const dateOpts: Intl.DateTimeFormatOptions = {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	};

	function formatDate(date: Date | string | number | null | undefined): string {
		if (!date) return '--';
		const d = date instanceof Date ? date : new Date(date);
		if (isNaN(d.getTime())) return '--';
		return d.toLocaleDateString(undefined, dateOpts);
	}

	function formatTimestamp(ts: number | null): string {
		if (!ts || ts === 0) return 'Never';
		return new Date(ts).toLocaleDateString(undefined, dateOpts);
	}

	const EXPECTED_INTERVALS: Record<string, number> = {
		'check-secrets': 15 * 60 * 1000,
		'process-reminders': 15 * 60 * 1000
	};
	const DEFAULT_INTERVAL = 24 * 60 * 60 * 1000;

	function getCronHealth(
		jobName: string,
		lastExecution: number
	): 'healthy' | 'warning' {
		if (lastExecution === 0) return 'warning';
		const expected = EXPECTED_INTERVALS[jobName] ?? DEFAULT_INTERVAL;
		return Date.now() - lastExecution > 2 * expected ? 'warning' : 'healthy';
	}

	function successRate(success: number, total: number): string {
		if (total === 0) return '--';
		return ((success / total) * 100).toFixed(1) + '%';
	}
</script>

<svelte:head>
	<title>Admin Dashboard - KeyFate</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-6 py-12">
	<!-- Header -->
	<div class="mb-10 flex items-center gap-4">
		<a
			href="/dashboard"
			class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
		>
			<ArrowLeft class="h-4 w-4" />
			Back
		</a>
		<h1 class="font-space text-3xl font-light tracking-tight">Admin Dashboard</h1>
	</div>

	<!-- Overview Cards -->
	<div class="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Total Secrets</Card.Title>
				<Lock class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{secretCounts.total}</div>
				<p class="text-muted-foreground text-xs">
					{secretCounts.active} active / {secretCounts.paused} paused / {secretCounts.triggered} triggered / {secretCounts.failed} failed
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Total Users</Card.Title>
				<Users class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{userCounts.total}</div>
				<p class="text-muted-foreground text-xs">
					{userCounts.withActiveSecrets} with active secrets / {userCounts.proUsers} pro
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Emails Sent</Card.Title>
				<Mail class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{emailStats.sent}</div>
				<p class="text-muted-foreground text-xs">
					{emailStats.sentLast24h} in last 24h
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Emails Failed</Card.Title>
				<AlertCircle class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{emailStats.failed}</div>
				<p class="text-muted-foreground text-xs">
					{emailStats.failedLast24h} in last 24h
				</p>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Problems Section -->
	<div class="mb-12 space-y-8">
		<div>
			<div class="mb-4 flex items-center gap-3">
				<h2 class="font-space text-xl font-light tracking-tight">Failed Secrets</h2>
				<Badge variant={failedSecrets.length > 0 ? 'destructive' : 'secondary'}>
					{failedSecrets.length}
				</Badge>
			</div>

			{#if failedSecrets.length > 0}
				<div class="rounded-md border">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Title</Table.Head>
								<Table.Head>Owner</Table.Head>
								<Table.Head>Last Error</Table.Head>
								<Table.Head>Updated</Table.Head>
								<Table.Head class="text-right">Retries</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each failedSecrets as secret}
								<Table.Row>
									<Table.Cell class="font-medium">{secret.title}</Table.Cell>
									<Table.Cell class="text-muted-foreground">{secret.ownerEmail}</Table.Cell>
									<Table.Cell class="max-w-xs truncate text-sm">{secret.lastError ?? '--'}</Table.Cell>
									<Table.Cell class="text-muted-foreground text-sm">{formatDate(secret.updatedAt)}</Table.Cell>
									<Table.Cell class="text-right">{secret.retryCount ?? 0}</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			{:else}
				<p class="text-muted-foreground text-sm">No failed secrets.</p>
			{/if}
		</div>

		<hr class="border-border" />

		<div>
			<div class="mb-4 flex items-center gap-3">
				<h2 class="font-space text-xl font-light tracking-tight">Email Failures</h2>
				<Badge variant={emailFailures.length > 0 ? 'destructive' : 'secondary'}>
					{emailFailures.length}
				</Badge>
			</div>

			{#if emailFailures.length > 0}
				<div class="rounded-md border">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Recipient</Table.Head>
								<Table.Head>Error</Table.Head>
								<Table.Head>Type</Table.Head>
								<Table.Head>Provider</Table.Head>
								<Table.Head>Created</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each emailFailures as failure}
								<Table.Row>
									<Table.Cell class="font-medium">{failure.recipient}</Table.Cell>
									<Table.Cell class="max-w-xs truncate text-sm">{failure.error}</Table.Cell>
									<Table.Cell>
										<Badge variant="outline">{failure.type}</Badge>
									</Table.Cell>
									<Table.Cell class="text-muted-foreground">{failure.provider ?? '--'}</Table.Cell>
									<Table.Cell class="text-muted-foreground text-sm">{formatDate(failure.createdAt)}</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			{:else}
				<p class="text-muted-foreground text-sm">No email failures.</p>
			{/if}
		</div>
	</div>

	<!-- System Section -->
	<hr class="border-border mb-12" />

	<div>
		<div class="mb-6 flex items-center gap-3">
			<h2 class="font-space text-xl font-light tracking-tight">Cron Jobs</h2>
			<Activity class="text-muted-foreground h-4 w-4" />
		</div>

		{#if cronEntries.length > 0}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each cronEntries as [jobName, stats]}
					{@const health = getCronHealth(jobName, stats.lastExecution)}
					<Card.Root>
						<Card.Header class="pb-2">
							<div class="flex items-center justify-between">
								<Card.Title class="text-sm font-medium">{jobName}</Card.Title>
								{#if health === 'healthy'}
									<CheckCircle class="text-primary h-4 w-4" />
								{:else}
									<AlertCircle class="text-destructive h-4 w-4" />
								{/if}
							</div>
						</Card.Header>
						<Card.Content class="space-y-1 text-sm">
							<div class="text-muted-foreground flex justify-between">
								<span>Last run</span>
								<span>{formatTimestamp(stats.lastExecution)}</span>
							</div>
							<div class="text-muted-foreground flex justify-between">
								<span>Success rate</span>
								<span>{successRate(stats.successCount, stats.totalExecutions)}</span>
							</div>
							<div class="text-muted-foreground flex justify-between">
								<span>Executions</span>
								<span>{stats.totalExecutions}</span>
							</div>
							<div class="text-muted-foreground flex justify-between">
								<span>Avg duration</span>
								<span>{stats.averageDuration}ms</span>
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		{:else}
			<p class="text-muted-foreground text-sm">No cron job data available yet.</p>
		{/if}
	</div>
</div>
