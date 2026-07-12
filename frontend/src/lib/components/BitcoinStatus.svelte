<script lang="ts">
	import * as Alert from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { AlertTriangle, Bitcoin, Clock } from '@lucide/svelte';
	import { untrack } from 'svelte';

	let { secretId }: { secretId: string } = $props();

	interface BitcoinStatusData {
		enabled: boolean;
		utxo: {
			id: string;
			txId: string;
			amountSats: number;
			ttlBlocks: number;
			status: string;
			generation?: number;
		} | null;
		estimatedDaysRemaining: number | null;
		refreshesRemaining: number | null;
		hasPreSignedTx: boolean;
		network: 'mainnet' | 'testnet' | null;
	}

	let statusData = $state<BitcoinStatusData | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let statusVariant = $derived<'default' | 'secondary' | 'destructive' | 'outline'>(
		statusData?.utxo?.status === 'confirmed'
			? 'default'
			: statusData?.utxo?.status === 'pending'
				? 'secondary'
				: statusData?.utxo?.status === 'expired'
					? 'destructive'
					: 'outline'
	);
	let estimatedTimeRemaining = $derived.by(() => {
		const days = statusData?.estimatedDaysRemaining;
		if (!days || days <= 0) return null;
		if (days < 1) return `~${Math.max(1, Math.round(days * 24))} hours`;
		return `~${Math.round(days)} days`;
	});

	async function fetchStatus() {
		try {
			const response = await fetch(`/api/secrets/${secretId}/bitcoin-status`);
			if (!response.ok) throw new Error('Failed to fetch Bitcoin status');
			statusData = await response.json();
			error = null;
		} catch (fetchError) {
			error = fetchError instanceof Error ? fetchError.message : 'Failed to load status';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		untrack(() => fetchStatus());
	});
</script>

<Card.Root>
	<Card.Header>
		<div class="flex items-center justify-between">
			<Card.Title class="flex items-center gap-2">
				<Bitcoin class="h-5 w-5" />
				Bitcoin Timelock
			</Card.Title>
			{#if statusData?.utxo}
				<Badge variant={statusVariant}>{statusData.utxo.status}</Badge>
			{/if}
		</div>
	</Card.Header>
	<Card.Content>
		{#if loading}
			<div class="bg-muted h-4 w-3/4 animate-pulse rounded"></div>
		{:else if error}
			<Alert.Root variant="destructive">
				<AlertTriangle class="h-4 w-4" />
				<Alert.Description>{error}</Alert.Description>
			</Alert.Root>
		{:else if !statusData?.enabled}
			<p class="text-muted-foreground text-sm">No Bitcoin timelock configured for this secret.</p>
		{:else if statusData.utxo}
			<div class="space-y-3 text-sm">
				<div class="flex justify-between">
					<span class="text-muted-foreground">Amount locked</span>
					<span class="font-medium">{statusData.utxo.amountSats.toLocaleString()} sats</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">Transaction</span>
					<span class="max-w-[200px] truncate font-mono text-xs">{statusData.utxo.txId}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">Network</span>
					<span>{statusData.network}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">CSV delay</span>
					<span>{statusData.utxo.ttlBlocks.toLocaleString()} blocks</span>
				</div>
				{#if estimatedTimeRemaining}
					<Separator />
					<div class="flex items-center gap-2">
						<Clock class="text-muted-foreground h-4 w-4" />
						<span class="font-medium">Time remaining: {estimatedTimeRemaining}</span>
					</div>
				{/if}
				<p class="text-muted-foreground text-xs">
					Refreshes require importing the encrypted owner continuity kit into the dedicated Bitcoin
					workflow. Session-stored keys are not supported.
				</p>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
