<script lang="ts">
	import { hex } from '@scure/base';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Alert from '$lib/components/ui/alert';
	import type { EncryptedRecoveryKit } from '$lib/crypto/recovery-kit';
	import {
		decryptBitcoinContinuityKit,
		encryptBitcoinContinuityKit,
		type BitcoinContinuityData
	} from '$lib/bitcoin/continuity-kit';
	import {
		bitcoinKeypairFromPrivateKey,
		generateBitcoinKeypair,
		zeroBitcoinKeypair
	} from '$lib/bitcoin/client-wallet';
	import { refreshBitcoinClient } from '$lib/bitcoin/client-operations';
	import { encryptBitcoinRecoveryEnvelope } from '$lib/bitcoin/recovery-envelope';
	import type { BitcoinNetwork } from '$lib/bitcoin/network';

	interface RefreshStatus {
		id: string;
		txId: string;
		outputIndex: number;
		amountSats: number;
		ttlBlocks: number;
		timelockScript: string;
		ownerPubkey: string;
		recipientAddress: string;
		recipientId: string;
		recipientNostrPubkey: string;
		nostrCapsuleEventId: string;
		generation: number;
	}

	let {
		secretId,
		network,
		status,
		onrefreshed
	}: {
		secretId: string;
		network: BitcoinNetwork;
		status: RefreshStatus;
		onrefreshed: () => void;
	} = $props();

	let selectedFile = $state<File | null>(null);
	let passphrase = $state('');
	let replacementPassphrase = $state('');
	let replacementConfirmation = $state('');
	let feeRate = $state('2');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let replacementEnvelope = $state<Awaited<ReturnType<typeof encryptBitcoinContinuityKit>> | null>(
		null
	);

	function assertBindings(kit: BitcoinContinuityData): void {
		if (
			kit.secretId !== secretId ||
			kit.network !== network ||
			kit.generation !== status.generation ||
			kit.currentUtxo.txId !== status.txId ||
			kit.currentUtxo.outputIndex !== status.outputIndex ||
			kit.currentUtxo.amountSats !== status.amountSats ||
			kit.currentTimelockScriptHex !== status.timelockScript ||
			kit.recipientAddress !== status.recipientAddress ||
			kit.recipientId !== status.recipientId ||
			kit.recipientNostrPubkey !== status.recipientNostrPubkey ||
			kit.nostrCapsuleEventId !== status.nostrCapsuleEventId ||
			kit.ttlBlocks !== status.ttlBlocks
		)
			throw new Error('Continuity kit does not match the current Bitcoin generation');
	}

	async function refresh(): Promise<void> {
		if (!selectedFile) return;
		if (replacementPassphrase.length < 12 || replacementPassphrase !== replacementConfirmation) {
			error = 'Use matching replacement-kit passphrases of at least 12 characters.';
			return;
		}
		busy = true;
		error = null;
		let ownerPrivateBytes: Uint8Array | null = null;
		let symmetricKeyBytes: Uint8Array | null = null;
		let ownerKeypair: ReturnType<typeof bitcoinKeypairFromPrivateKey> | null = null;
		let branchKeypair: ReturnType<typeof generateBitcoinKeypair> | null = null;
		let broadcastSucceeded = false;
		let persistenceSucceeded = false;
		try {
			const envelope = JSON.parse(await selectedFile.text()) as EncryptedRecoveryKit;
			const kit = await decryptBitcoinContinuityKit(envelope, passphrase);
			assertBindings(kit);
			ownerPrivateBytes = hex.decode(kit.ownerPrivateKeyHex);
			symmetricKeyBytes = hex.decode(kit.symmetricKeyHex);
			ownerKeypair = bitcoinKeypairFromPrivateKey(ownerPrivateBytes);
			if (hex.encode(ownerKeypair.pubkey) !== status.ownerPubkey) {
				throw new Error('Continuity owner key does not match the current generation');
			}
			const selectedFeeRate = Number(feeRate);
			if (!Number.isSafeInteger(selectedFeeRate) || selectedFeeRate <= 0) {
				throw new Error('Fee rate must be a positive whole number');
			}
			branchKeypair = generateBitcoinKeypair();
			const result = await refreshBitcoinClient({
				ownerKeypair,
				newBranchKeypair: branchKeypair,
				currentUtxo: {
					txId: status.txId,
					outputIndex: status.outputIndex,
					amountSats: status.amountSats
				},
				currentScript: hex.decode(status.timelockScript),
				ttlBlocks: status.ttlBlocks,
				feeRateSatsPerVbyte: selectedFeeRate,
				symmetricKeyK: symmetricKeyBytes,
				nostrEventId: status.nostrCapsuleEventId,
				recipientAddress: status.recipientAddress,
				network
			});
			branchKeypair = null;
			broadcastSucceeded = true;
			const encryptedRecoveryEnvelope = encryptBitcoinRecoveryEnvelope(
				{
					version: 1,
					secretId,
					generation: status.generation + 1,
					network,
					txHex: result.preSignedRecipientTx,
					fundingTxId: result.newTxId,
					fundingOutputIndex: result.newOutputIndex,
					amountSats: result.newAmountSats,
					timelockScriptHex: hex.encode(result.newTimelockScript),
					ttlBlocks: status.ttlBlocks,
					recipientAddress: status.recipientAddress,
					maxFeeSats: Math.ceil(267 * selectedFeeRate),
					nostrCapsuleEventId: status.nostrCapsuleEventId,
					nostrManifestEvent: kit.nostrManifestEvent,
					nostrCapsuleEvent: kit.nostrCapsuleEvent
				},
				ownerKeypair.privkey,
				status.recipientNostrPubkey
			);
			const csrfResponse = await fetch('/api/csrf-token');
			const csrf = (await csrfResponse.json()) as { token: string };
			const response = await fetch(`/api/secrets/${secretId}/store-bitcoin-refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf.token },
				body: JSON.stringify({
					currentUtxoId: status.id,
					newTxId: result.newTxId,
					newOutputIndex: result.newOutputIndex,
					newAmountSats: result.newAmountSats,
					newTimelockScript: hex.encode(result.newTimelockScript),
					newBranchPubkey: hex.encode(result.newBranchPubkey),
					ttlBlocks: status.ttlBlocks,
					recipientAddress: status.recipientAddress,
					network,
					generation: status.generation + 1,
					nostrCapsuleEventId: status.nostrCapsuleEventId,
					encryptedRecoveryEnvelope
				})
			});
			if (!response.ok)
				throw new Error(
					((await response.json()) as { error?: string }).error ?? 'Refresh persistence failed'
				);
			persistenceSucceeded = true;
			const replacement: BitcoinContinuityData = {
				...kit,
				generation: status.generation + 1,
				currentUtxo: {
					txId: result.newTxId,
					outputIndex: result.newOutputIndex,
					amountSats: result.newAmountSats
				},
				currentTimelockScriptHex: hex.encode(result.newTimelockScript)
			};
			replacementEnvelope = await encryptBitcoinContinuityKit(replacement, replacementPassphrase);
			passphrase = '';
			replacementPassphrase = '';
			replacementConfirmation = '';
		} catch (refreshError) {
			error = persistenceSucceeded
				? 'Refresh persisted, but replacement-kit creation failed. Reconciliation is required before another refresh.'
				: broadcastSucceeded
					? `Reconciliation required: the refresh broadcast succeeded but persistence did not complete. ${refreshError instanceof Error ? refreshError.message : ''}`
					: refreshError instanceof Error
						? refreshError.message
						: 'Bitcoin refresh failed';
		} finally {
			if (branchKeypair) zeroBitcoinKeypair(branchKeypair);
			if (ownerKeypair) zeroBitcoinKeypair(ownerKeypair);
			ownerPrivateBytes?.fill(0);
			symmetricKeyBytes?.fill(0);
			busy = false;
		}
	}

	function downloadReplacement(): void {
		if (!replacementEnvelope) return;
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(replacementEnvelope, null, 2)], { type: 'application/json' })
		);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `keyfate-bitcoin-continuity-${secretId}-replacement.json`;
		anchor.click();
		URL.revokeObjectURL(url);
		replacementEnvelope = null;
		onrefreshed();
	}
</script>

<div class="border-border mt-4 space-y-3 rounded-md border p-3">
	<h4 class="font-medium">Refresh with encrypted continuity kit</h4>
	{#if error}<Alert.Root variant="destructive"
			><Alert.Description>{error}</Alert.Description></Alert.Root
		>{/if}
	<div>
		<Label for="continuity-file">Encrypted kit file</Label><Input
			id="continuity-file"
			type="file"
			accept="application/json"
			onchange={(event) => (selectedFile = event.currentTarget.files?.[0] ?? null)}
		/>
	</div>
	<div class="grid gap-3 sm:grid-cols-2">
		<div>
			<Label for="continuity-passphrase">Current passphrase</Label><Input
				id="continuity-passphrase"
				type="password"
				bind:value={passphrase}
			/>
		</div>
		<div>
			<Label for="refresh-fee">Fee (sat/vB)</Label><Input
				id="refresh-fee"
				type="number"
				bind:value={feeRate}
			/>
		</div>
		<div>
			<Label for="replacement-passphrase">Replacement passphrase</Label><Input
				id="replacement-passphrase"
				type="password"
				bind:value={replacementPassphrase}
			/>
		</div>
		<div>
			<Label for="replacement-confirmation">Confirm replacement passphrase</Label><Input
				id="replacement-confirmation"
				type="password"
				bind:value={replacementConfirmation}
			/>
		</div>
	</div>
	{#if !replacementEnvelope}<Button type="button" onclick={refresh} disabled={busy || !selectedFile}
			>Broadcast and atomically persist refresh</Button
		>{/if}
	{#if replacementEnvelope}
		<Alert.Root
			><Alert.Description
				>Refresh persisted. Download the replacement encrypted kit before considering it complete.</Alert.Description
			></Alert.Root
		>
		<Button type="button" onclick={downloadReplacement}>Download required replacement kit</Button>
	{/if}
</div>
