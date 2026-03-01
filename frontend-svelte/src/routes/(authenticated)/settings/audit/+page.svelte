<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import AuditLogsPage from '$lib/components/AuditLogsPage.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Audit Logs - KeyFate</title>
</svelte:head>

<div class="space-y-8">
	<div>
		<h2 class="font-space text-xl font-bold tracking-tight">Audit Logs</h2>
		<p class="text-sm text-muted-foreground mt-1">
			{data.userTier === 'pro'
				? 'Comprehensive audit trail of all activities in your account'
				: 'Comprehensive audit trails are a Pro feature'}
		</p>
	</div>

	{#if data.userTier !== 'pro'}
		<div class="space-y-6">
			<div>
				<h3 class="font-space text-lg font-bold tracking-tight">Audit Logs</h3>
				<p class="text-sm text-muted-foreground mt-1">Comprehensive audit trails are a Pro feature</p>
			</div>

			<p class="text-sm text-muted-foreground">
				Upgrade to Pro to access comprehensive audit logs that track all activities in your
				account, including:
			</p>
			<ul class="text-sm text-muted-foreground list-inside list-disc space-y-2">
				<li>Secret creation, editing, and deletion</li>
				<li>Check-in activity</li>
				<li>Recipient management</li>
				<li>Login events</li>
				<li>Subscription changes</li>
				<li>Settings updates</li>
			</ul>
			<div class="flex gap-4 pt-2">
				<Button href="/pricing" class="uppercase tracking-wide font-semibold">Upgrade to Pro</Button>
				<Button variant="outline" href="/dashboard" class="uppercase tracking-wide font-semibold">Back to Dashboard</Button>
			</div>
		</div>
	{:else}
		<AuditLogsPage />
	{/if}
</div>
