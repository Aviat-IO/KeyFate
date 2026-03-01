<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { TIER_CONFIGS } from '$lib/constants/tiers';
	import { AlertTriangle, Crown } from '@lucide/svelte';
	import { invalidateAll } from '$app/navigation';
	import type { UserTierInfo } from '$lib/types/subscription';

	let { tierInfo }: { tierInfo: UserTierInfo | null } = $props();

	let showDowngradeDialog = $state(false);
	let showCancelDialog = $state(false);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	const isProUser = $derived(tierInfo?.tier?.tiers?.name === 'pro');
	const subscription = $derived(tierInfo?.subscription);
	const scheduledDowngradeAt = $derived(
		subscription && 'scheduledDowngradeAt' in subscription
			? (subscription as Record<string, unknown>).scheduledDowngradeAt
			: undefined
	);
	const currentPeriodEnd = $derived(
		subscription && 'currentPeriodEnd' in subscription
			? (subscription as Record<string, unknown>).currentPeriodEnd
			: undefined
	);

	async function handleScheduleDowngrade() {
		isLoading = true;
		error = null;

		try {
			const response = await fetch('/api/user/subscription/schedule-downgrade', {
				method: 'POST'
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to schedule downgrade');
			}

			showDowngradeDialog = false;
			await invalidateAll();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to schedule downgrade';
		} finally {
			isLoading = false;
		}
	}

	async function handleCancelDowngrade() {
		isLoading = true;
		error = null;

		try {
			const response = await fetch('/api/user/subscription/cancel-downgrade', {
				method: 'POST'
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to cancel downgrade');
			}

			showCancelDialog = false;
			await invalidateAll();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to cancel downgrade';
		} finally {
			isLoading = false;
		}
	}

	function formatDate(date: unknown): string {
		if (!date) return 'N/A';
		return new Date(date as string).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
</script>

<div class="space-y-8">
	<div>
		<div class="flex items-center justify-between">
			<div>
				<h3 class="font-space text-lg font-bold tracking-tight flex items-center gap-2">
					Current Plan
					{#if isProUser && !scheduledDowngradeAt}
						<Crown class="text-primary h-5 w-5" />
					{/if}
				</h3>
				<p class="text-sm text-muted-foreground mt-1">Your subscription details</p>
			</div>
			<div class="flex items-center gap-2">
				<Badge variant={isProUser ? 'default' : 'secondary'}>
					{isProUser ? 'Pro' : 'Free'}
				</Badge>
				{#if scheduledDowngradeAt}
					<Badge variant="destructive" class="flex items-center gap-1">
						<AlertTriangle class="h-3 w-3" />
						Ending Soon
					</Badge>
				{/if}
			</div>
		</div>
	</div>

	<div class="space-y-6">
		{#if isProUser && subscription}
			<div>
				<span class="text-xs text-muted-foregroundr font-medium block">Status</span>
				<p class="text-sm text-foreground mt-1 capitalize">
					{'status' in subscription ? String(subscription.status) : 'Active'}
				</p>
			</div>
			{#if currentPeriodEnd}
				<div>
					<span class="text-xs text-muted-foregroundr font-medium block">Current Period Ends</span>
					<p class="text-sm text-foreground mt-1">{formatDate(currentPeriodEnd)}</p>
				</div>
			{/if}
		{/if}

		{#if !isProUser}
			<div>
				<span class="text-xs text-muted-foregroundr font-medium block">Limits</span>
				<ul class="mt-2 space-y-1 text-sm text-foreground">
					<li>• 1 secret</li>
					<li>• 1 recipient per secret</li>
					<li>• Limited check-in intervals</li>
				</ul>
			</div>
		{/if}

		{#if scheduledDowngradeAt}
			<div class="border-destructive/50 rounded-lg border p-4">
				<div class="flex gap-2">
					<AlertTriangle class="text-destructive mt-0.5 h-5 w-5 flex-shrink-0" />
					<div class="flex-1">
						<p class="text-destructive font-medium text-sm">Downgrade Scheduled</p>
						<p class="text-muted-foreground text-sm">
							Your subscription will end on {formatDate(scheduledDowngradeAt)}. You'll be
							downgraded to the Free plan at that time.
						</p>
					</div>
				</div>
			</div>
		{/if}

		{#if error}
			<div class="border-destructive/50 rounded-lg border p-4">
				<p class="text-destructive text-sm">{error}</p>
			</div>
		{/if}
	</div>
</div>

<div class="border-t border-border pt-8 space-y-4">
	<div>
		<h3 class="font-space text-lg font-bold tracking-tight">Manage Subscription</h3>
		<p class="text-sm text-muted-foreground mt-1">
			{isProUser ? 'Change your subscription plan' : 'Upgrade to unlock more features'}
		</p>
	</div>

	<div>
		{#if !isProUser}
			<Button href="/pricing" class="w-full font-semibold">Upgrade to Pro</Button>
		{:else if scheduledDowngradeAt}
			<Button
				variant="outline"
				onclick={() => (showCancelDialog = true)}
				disabled={isLoading}
				class="w-full font-semibold"
			>
				{isLoading ? 'Processing...' : 'Cancel Scheduled Downgrade'}
			</Button>
		{:else}
			<Button
				variant="destructive"
				onclick={() => (showDowngradeDialog = true)}
				disabled={isLoading}
				class="w-full font-semibold"
			>
				{isLoading ? 'Processing...' : 'Downgrade to Free'}
			</Button>
		{/if}
	</div>
</div>

<Dialog.Root bind:open={showDowngradeDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Downgrade to Free Plan?</Dialog.Title>
			<Dialog.Description>
				<div>
					<p class="text-muted-foreground text-sm">
						Your Pro subscription will remain active until {formatDate(currentPeriodEnd)}. After
						that date, you'll be downgraded to the Free plan.
					</p>
					<p class="text-muted-foreground mt-4 text-sm">
						You'll be limited to Free tier features:
					</p>
					<ul class="text-muted-foreground mt-2 list-inside list-disc space-y-1 text-sm">
						{#each TIER_CONFIGS.free?.features || [] as feature}
							<li>{feature}</li>
						{/each}
					</ul>
					<p class="text-muted-foreground mt-4 text-sm">
						Your existing secrets will be preserved (grandfathered).
					</p>
				</div>
			</Dialog.Description>
		</Dialog.Header>
		{#if error}
			<div class="border-destructive bg-destructive/10 rounded-lg border p-3">
				<p class="text-destructive text-sm">{error}</p>
			</div>
		{/if}
		<Dialog.Footer>
			<Button
				variant="outline"
				onclick={() => {
					showDowngradeDialog = false;
					error = null;
				}}
				disabled={isLoading}
			>
				Cancel
			</Button>
			<Button onclick={handleScheduleDowngrade} disabled={isLoading} variant="destructive">
				{isLoading ? 'Processing...' : 'Confirm Downgrade'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={showCancelDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Cancel Scheduled Downgrade?</Dialog.Title>
			<Dialog.Description>
				This will cancel your scheduled downgrade. Your Pro subscription will continue as normal
				and renew at the end of the current period.
			</Dialog.Description>
		</Dialog.Header>
		{#if error}
			<div class="border-destructive bg-destructive/10 rounded-lg border p-3">
				<p class="text-destructive text-sm">{error}</p>
			</div>
		{/if}
		<Dialog.Footer>
			<Button
				variant="outline"
				onclick={() => {
					showCancelDialog = false;
					error = null;
				}}
				disabled={isLoading}
			>
				No, Keep Downgrade
			</Button>
			<Button onclick={handleCancelDowngrade} disabled={isLoading}>
				{isLoading ? 'Processing...' : 'Yes, Cancel Downgrade'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
