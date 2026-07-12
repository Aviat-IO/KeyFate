<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Alert from '$lib/components/ui/alert';
	import { toast } from 'svelte-sonner';
	import { AlertTriangle, Bitcoin, Eye, EyeOff, Loader2, Radio } from '@lucide/svelte';
	import {
		isValidNsec,
		nsecToSecretKey,
		recoverShareFromBitcoinEnvelope,
		type DecryptedShareResult,
		type RecoveredBitcoinShare
	} from '$lib/crypto/recovery-flows';
	import { broadcastTransaction } from '$lib/bitcoin/broadcast';

	interface Props {
		onComplete: (results: DecryptedShareResult[]) => void;
		onError: (message: string) => void;
	}

	let { onComplete, onError }: Props = $props();
	let envelopeInput = $state('');
	let senderPubkey = $state('');
	let expectedGeneration = $state<number | undefined>(undefined);
	let nsecInput = $state('');
	let nsecVisible = $state(false);
	let recovering = $state(false);
	let recovered = $state<RecoveredBitcoinShare | null>(null);
	let broadcastConfirmed = $state(false);
	let broadcasting = $state(false);

	let validSender = $derived(/^[0-9a-f]{64}$/.test(senderPubkey.trim()));
	let validGeneration = $derived(
		typeof expectedGeneration === 'number' &&
			Number.isInteger(expectedGeneration) &&
			expectedGeneration >= 1
	);
	let validNsec = $derived(nsecInput.trim().length > 0 && isValidNsec(nsecInput.trim()));
	let validEnvelope = $derived.by(() => {
		try {
			return typeof JSON.parse(envelopeInput) === 'object';
		} catch {
			return false;
		}
	});

	async function recoverEnvelope() {
		if (!validSender || !validGeneration || !validNsec || !validEnvelope) return;
		recovering = true;
		onError('');
		const secretKey = nsecToSecretKey(nsecInput.trim());
		try {
			const result = recoverShareFromBitcoinEnvelope(
				JSON.parse(envelopeInput),
				secretKey,
				senderPubkey.trim(),
				expectedGeneration!
			);
			recovered = result;
			onComplete([
				{
					share: result.share,
					shareIndex: result.shareIndex,
					threshold: result.threshold,
					totalShares: result.totalShares,
					secretId: result.secretId
				}
			]);
			nsecInput = '';
			toast.success('Bitcoin recovery artifact verified');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown recovery error';
			onError(`Bitcoin recovery failed: ${message}`);
			toast.error('Bitcoin recovery failed');
		} finally {
			secretKey.fill(0);
			recovering = false;
		}
	}

	async function broadcastRecoveredTransaction() {
		if (!recovered || !broadcastConfirmed) return;
		broadcasting = true;
		try {
			const txId = await broadcastTransaction(recovered.transactionHex, recovered.network);
			toast.success(`Transaction broadcast: ${txId}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Broadcast failed';
			onError(`Bitcoin broadcast failed: ${message}`);
			toast.error('Transaction was not accepted');
		} finally {
			broadcasting = false;
		}
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="font-space text-xl font-bold tracking-tight">Recover via Bitcoin</h2>
		<p class="text-muted-foreground mt-1 text-sm">
			Decrypt the recipient envelope, verify every transaction and Nostr binding, then optionally
			broadcast after the CSV delay.
		</p>
	</div>

	<div class="space-y-2">
		<Label for="bitcoin-envelope">Encrypted Recovery Envelope</Label>
		<Textarea
			id="bitcoin-envelope"
			bind:value={envelopeInput}
			placeholder="Paste the recipient-encrypted envelope from the disclosure notice"
			class="font-mono text-xs"
			rows={6}
			spellcheck={false}
		/>
	</div>

	<div class="space-y-2">
		<Label for="bitcoin-sender">Expected Sender Pubkey</Label>
		<Input
			id="bitcoin-sender"
			bind:value={senderPubkey}
			placeholder="64-character hex pubkey"
			class="font-mono text-xs"
			spellcheck={false}
		/>
	</div>

	<div class="space-y-2">
		<Label for="bitcoin-generation">Expected Current Generation</Label>
		<Input
			id="bitcoin-generation"
			type="number"
			min="1"
			step="1"
			bind:value={expectedGeneration}
			placeholder="Generation from the latest disclosure notice"
		/>
		<p class="text-muted-foreground text-xs">
			Use the generation printed separately in the latest disclosure notice. Older superseded
			envelopes are rejected.
		</p>
	</div>

	<div class="space-y-2">
		<Label for="bitcoin-nsec">Recipient Nostr Private Key (nsec)</Label>
		<Alert.Root variant="destructive">
			<AlertTriangle class="h-4 w-4" />
			<Alert.Description class="text-xs">
				The nsec is used only in this browser to decrypt the envelope and is cleared immediately.
			</Alert.Description>
		</Alert.Root>
		<div class="relative">
			<Textarea
				id="bitcoin-nsec"
				bind:value={nsecInput}
				placeholder="nsec1..."
				rows={2}
				class="pr-10 font-mono text-sm"
				style={nsecVisible ? '' : '-webkit-text-security: disc; text-security: disc;'}
				autocomplete="off"
				spellcheck={false}
			/>
			<button
				type="button"
				onclick={() => (nsecVisible = !nsecVisible)}
				class="text-muted-foreground hover:text-foreground absolute top-2 right-2 p-1"
				aria-label={nsecVisible ? 'Hide private key' : 'Show private key'}
			>
				{#if nsecVisible}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
			</button>
		</div>
	</div>

	<Button
		onclick={recoverEnvelope}
		disabled={!validSender || !validGeneration || !validNsec || !validEnvelope || recovering}
		class="w-full"
	>
		{#if recovering}
			<Loader2 class="mr-2 h-4 w-4 animate-spin" />
			Verifying…
		{:else}
			<Bitcoin class="mr-2 h-4 w-4" />
			Decrypt and verify recovery artifact
		{/if}
	</Button>

	{#if recovered}
		<div class="border-border space-y-4 rounded-md border p-4">
			<div class="space-y-1 text-sm">
				<p><strong>Network:</strong> {recovered.network}</p>
				<p><strong>Recipient:</strong> {recovered.recipientAddress}</p>
				<p><strong>Generation:</strong> {recovered.generation}</p>
			</div>
			<div class="flex items-start gap-2">
				<Checkbox
					id="broadcast-confirmation"
					checked={broadcastConfirmed}
					onCheckedChange={(checked) => (broadcastConfirmed = checked === true)}
				/>
				<Label for="broadcast-confirmation" class="text-sm leading-5">
					I verified the network and recipient address and understand the transaction will fail
					until its CSV delay has matured.
				</Label>
			</div>
			<Button
				variant="outline"
				onclick={broadcastRecoveredTransaction}
				disabled={!broadcastConfirmed || broadcasting}
			>
				{#if broadcasting}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}
					<Radio class="mr-2 h-4 w-4" />
				{/if}
				Broadcast delayed transaction
			</Button>
		</div>
	{/if}
</div>
