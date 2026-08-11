<script lang="ts">
	import { untrack } from 'svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { toast } from 'svelte-sonner';
	import { Buffer } from 'buffer';
	import { Check, Copy, Info, PlusCircle, ShieldAlert, ShieldCheck, Trash2 } from '@lucide/svelte';
	import sss from 'shamirs-secret-sharing';
	import { recoverAuthenticatedSecret } from '$lib/crypto/recovery-v3';

	let {
		initialShares = [],
		companyName = 'KeyFate'
	}: { initialShares?: string[]; companyName?: string } = $props();
	let shares = $state<string[]>(
		untrack(() =>
			initialShares.length === 0
				? ['', '']
				: initialShares.length === 1
					? [initialShares[0], '']
					: [...initialShares]
		)
	);
	let recoveredSecret = $state<string | null>(null);
	let error = $state<string | null>(null);
	let isLoading = $state(false);
	let isCopied = $state(false);
	let legacyMode = $state(false);

	function resetResult() {
		recoveredSecret = null;
		error = null;
	}
	function handleShareChange(index: number, value: string) {
		shares[index] = value.trim();
		resetResult();
	}
	function addShareInput() {
		shares = [...shares, ''];
	}
	function removeShareInput(index: number) {
		if (shares.length <= 2) {
			error = 'You need at least two shares to attempt recovery.';
			return;
		}
		shares = shares.filter((_, itemIndex) => itemIndex !== index);
	}
	function recoverLegacy(validShares: string[]): string {
		const shareBuffers = validShares.map((shareHex) => {
			if (!/^(?:[0-9a-fA-F]{2})+$/.test(shareHex))
				throw new Error('Legacy shares must be even-length hexadecimal strings');
			return Buffer.from(shareHex, 'hex');
		});
		try {
			return sss.combine(shareBuffers).toString('utf8');
		} finally {
			for (const share of shareBuffers) share.fill(0);
		}
	}
	function handleCombineShares() {
		isLoading = true;
		error = null;
		recoveredSecret = null;
		const validShares = shares.filter((share) => share.trim() !== '');
		if (validShares.length < 2) {
			error = 'Please provide at least two shares.';
			isLoading = false;
			return;
		}
		try {
			recoveredSecret = legacyMode
				? recoverLegacy(validShares)
				: recoverAuthenticatedSecret(validShares);
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : 'Invalid recovery material';
			error = legacyMode
				? `Unverified legacy interpolation failed: ${message}`
				: `Authenticated v3 recovery failed: ${message}. The input was not retried as legacy material.`;
		} finally {
			isLoading = false;
		}
	}
	async function handleCopySecret() {
		if (!recoveredSecret) return;
		try {
			await navigator.clipboard.writeText(recoveredSecret);
			isCopied = true;
			toast.success('Secret copied to clipboard.');
			setTimeout(() => (isCopied = false), 2000);
		} catch {
			toast.error('Failed to copy secret to clipboard.');
		}
	}
</script>

<div class="space-y-6">
	<div class="text-center"><h1 class="font-space mb-4 text-3xl font-bold">Secret Recovery</h1></div>
	<Alert.Root>
		<ShieldCheck class="h-4 w-4" />
		<Alert.Title>Authenticated v3 recovery</Alert.Title>
		<Alert.Description
			>Paste strict v3 share-envelope JSON. Context and AEAD authentication must succeed before
			plaintext is shown.</Alert.Description
		>
	</Alert.Root>
	<div class="border-border flex items-start gap-3 rounded-md border p-4">
		<Checkbox
			id="legacy-mode"
			checked={legacyMode}
			onCheckedChange={(checked) => {
				legacyMode = checked === true;
				resetResult();
			}}
		/>
		<div class="space-y-1">
			<Label for="legacy-mode">Unverified legacy mode</Label>
			<p class="text-muted-foreground text-sm">
				Deliberately enable only for old raw hexadecimal shares. Corruption, mixed sets,
				insufficient thresholds, and substitution cannot be detected. Failed v3 input is never
				downgraded automatically.
			</p>
		</div>
	</div>
	<div class="space-y-4">
		{#each shares as share, index}
			<div class="flex items-center space-x-2">
				<Textarea
					aria-label={`Recovery share ${index + 1}`}
					placeholder={legacyMode
						? `Legacy raw share ${index + 1}`
						: `Authenticated ${companyName} v3 envelope ${index + 1}`}
					value={share}
					oninput={(event) => handleShareChange(index, (event.target as HTMLTextAreaElement).value)}
					rows={legacyMode ? 2 : 6}
					class="flex-grow font-mono text-xs"
					disabled={isLoading}
				/>
				{#if shares.length > 2}<Button
						variant="ghost"
						size="icon"
						onclick={() => removeShareInput(index)}
						disabled={isLoading}
						aria-label="Remove share"><Trash2 class="h-4 w-4" /></Button
					>{/if}
			</div>
		{/each}
		<Button type="button" variant="outline" onclick={addShareInput} disabled={isLoading}
			><PlusCircle class="mr-2 h-4 w-4" /> Add Another Share</Button
		>
	</div>
	<Button
		type="button"
		onclick={handleCombineShares}
		disabled={isLoading || shares.filter((share) => share.trim()).length < 2}
		class="w-full"
		size="lg"
		>{isLoading
			? 'Recovering…'
			: legacyMode
				? 'Run Unverified Legacy Interpolation'
				: 'Recover Authenticated Secret'}</Button
	>
	{#if error}<Alert.Root variant="destructive"
			><ShieldAlert class="h-4 w-4" /><Alert.Title>Recovery Failed</Alert.Title><Alert.Description
				>{error}</Alert.Description
			></Alert.Root
		>{/if}
	{#if recoveredSecret}
		<Alert.Root variant={legacyMode ? 'destructive' : 'default'}>
			<ShieldCheck class="h-4 w-4" />
			<Alert.Title
				>{legacyMode ? 'Unverified Legacy Result' : 'Authenticated Secret Recovered'}</Alert.Title
			>
			<Alert.Description class="space-y-2">
				{#if legacyMode}<p>
						This output is interpolation only and has not been authenticated.
					</p>{/if}
				<Textarea
					value={recoveredSecret}
					readonly
					rows={4}
					class="bg-muted mt-2 w-full font-mono text-sm select-all"
				/>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onclick={handleCopySecret}
					disabled={isCopied}
					>{#if isCopied}<Check class="mr-2 h-3 w-3" /> Copied{:else}<Copy class="mr-2 h-3 w-3" /> Copy
						Result{/if}</Button
				>
			</Alert.Description>
		</Alert.Root>
	{/if}
	<div class="bg-muted/30 rounded-lg p-4">
		<div class="flex items-start gap-3">
			<Info class="text-muted-foreground mt-0.5 h-4 w-4" />
			<p class="text-muted-foreground text-sm">
				Cryptographic operations run locally after this page loads. The trusted KeyFate page code,
				browser extensions, and browser origin can still observe material and recovered plaintext.
				For sensitive recovery, use the documented offline build on a trusted device.
			</p>
		</div>
	</div>
</div>
