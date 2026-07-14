<script lang="ts">
	import * as btc from '@scure/btc-signer';
	import { hex } from '@scure/base';
	import { onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Alert from '$lib/components/ui/alert';
	import type { EphemeralBitcoinSetup } from '$lib/client/ephemeral-recovery-state';
	import {
		generateBitcoinKeypair,
		zeroBitcoinKeypair,
		type BitcoinKeypair
	} from '$lib/bitcoin/client-wallet';
	import { enableBitcoinClient } from '$lib/bitcoin/client-operations';
	import { discoverAddressUtxos } from '$lib/bitcoin/utxo-discovery';
	import { encryptBitcoinRecoveryEnvelope } from '$lib/bitcoin/recovery-envelope';
	import {
		encryptBitcoinContinuityKit,
		type BitcoinContinuityData
	} from '$lib/bitcoin/continuity-kit';
	import { getBitcoinNetworkParams } from '$lib/bitcoin/network';
	import type { UTXO } from '$lib/bitcoin/transaction';

	let {
		secretId,
		setup,
		oncomplete
	}: {
		secretId: string;
		setup: EphemeralBitcoinSetup;
		oncomplete: () => void;
	} = $props();

	let ownerKeypair = $state<BitcoinKeypair | null>(null);
	let ownerAddress = $state('');
	let utxos = $state<UTXO[]>([]);
	let selectedUtxoIndex = $state(-1);
	let recipientAddress = $state('');
	let recipientAddressConfirmation = $state('');
	let amountSats = $state('20000');
	let feeRate = $state('2');
	let ttlBlocks = $state('144');
	let passphrase = $state('');
	let passphraseConfirmation = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);
	let continuityEnvelope = $state<Awaited<ReturnType<typeof encryptBitcoinContinuityKit>> | null>(
		null
	);
	let kitDownloaded = $state(false);
	let stored = $state(false);

	function clearOwnerKey(): void {
		if (ownerKeypair) zeroBitcoinKeypair(ownerKeypair);
		ownerKeypair = null;
	}

	function clearSecrets(): void {
		clearOwnerKey();
		setup.plaintextK.fill(0);
	}

	onDestroy(clearSecrets);

	function generateOwnerAddress(): void {
		clearOwnerKey();
		ownerKeypair = generateBitcoinKeypair();
		const payment = btc.p2wpkh(ownerKeypair.pubkey, getBitcoinNetworkParams('signet'));
		if (!payment.address) throw new Error('Unable to generate owner Signet address');
		ownerAddress = payment.address;
		utxos = [];
		selectedUtxoIndex = -1;
		error = null;
	}

	async function discoverFunding(): Promise<void> {
		if (!ownerAddress) return;
		busy = true;
		error = null;
		try {
			utxos = await discoverAddressUtxos({ address: ownerAddress, network: 'signet' });
			selectedUtxoIndex = utxos.length === 1 ? 0 : -1;
			if (utxos.length === 0)
				error = 'No confirmed spendable Signet outpoint was found for this exact address.';
		} catch (discoveryError) {
			error = discoveryError instanceof Error ? discoveryError.message : 'Signet discovery failed';
		} finally {
			busy = false;
		}
	}

	async function provision(): Promise<void> {
		const selected = utxos[selectedUtxoIndex];
		if (!ownerKeypair || !selected) return;
		if (recipientAddress !== recipientAddressConfirmation) {
			error = 'Recipient-controlled Signet address confirmation does not match.';
			return;
		}
		if (passphrase.length < 12 || passphrase !== passphraseConfirmation) {
			error = 'Use matching continuity-kit passphrases of at least 12 characters.';
			return;
		}
		try {
			btc.Address(getBitcoinNetworkParams('signet')).decode(recipientAddress);
		} catch {
			error = 'Recipient address is not valid under Signet/testnet address rules.';
			return;
		}
		const amount = Number(amountSats);
		const fee = Number(feeRate);
		const ttl = Number(ttlBlocks);
		if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(fee) || !Number.isSafeInteger(ttl)) {
			error = 'Amount, fee rate, and CSV delay must be whole numbers.';
			return;
		}

		busy = true;
		error = null;
		let branchKeypair: BitcoinKeypair | null = generateBitcoinKeypair();
		let broadcastSucceeded = false;
		try {
			const result = await enableBitcoinClient({
				ownerKeypair,
				branchKeypair,
				fundingUtxo: selected,
				amountSats: amount,
				feeRateSatsPerVbyte: fee,
				symmetricKeyK: setup.plaintextK,
				nostrEventId: setup.nostrCapsuleEventId,
				recipientAddress,
				ttlBlocks: ttl,
				network: 'signet'
			});
			branchKeypair = null;
			broadcastSucceeded = true;
			const encryptedRecoveryEnvelope = encryptBitcoinRecoveryEnvelope(
				{
					version: 1,
					secretId,
					generation: 1,
					network: 'signet',
					txHex: result.preSignedRecipientTx,
					fundingTxId: result.txId,
					fundingOutputIndex: result.outputIndex,
					amountSats: amount,
					timelockScriptHex: hex.encode(result.timelockScript),
					ttlBlocks: ttl,
					recipientAddress,
					maxFeeSats: Math.ceil(267 * fee),
					nostrCapsuleEventId: setup.nostrCapsuleEventId,
					nostrManifestEvent: setup.nostrManifestEvent,
					nostrCapsuleEvent: setup.nostrCapsuleEvent
				},
				ownerKeypair.privkey,
				setup.recipientNostrPubkey
			);
			const csrfResponse = await fetch('/api/csrf-token');
			const csrf = (await csrfResponse.json()) as { token: string };
			const response = await fetch(`/api/secrets/${secretId}/store-bitcoin`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf.token },
				body: JSON.stringify({
					recipientId: setup.recipientId,
					txId: result.txId,
					outputIndex: result.outputIndex,
					amountSats: amount,
					timelockScript: hex.encode(result.timelockScript),
					ownerPubkey: hex.encode(result.ownerPubkey),
					branchPubkey: hex.encode(result.branchPubkey),
					ttlBlocks: ttl,
					recipientAddress,
					network: 'signet',
					generation: 1,
					nostrCapsuleEventId: setup.nostrCapsuleEventId,
					encryptedRecoveryEnvelope
				})
			});
			if (!response.ok)
				throw new Error(
					((await response.json()) as { error?: string }).error ??
						'Bitcoin setup persistence failed'
				);
			stored = true;
			const continuity: BitcoinContinuityData = {
				format: 'keyfate-bitcoin-continuity',
				version: 2,
				secretId,
				network: 'signet',
				generation: 1,
				ownerPrivateKeyHex: hex.encode(ownerKeypair.privkey),
				symmetricKeyHex: hex.encode(setup.plaintextK),
				nostrCapsuleEventId: setup.nostrCapsuleEventId,
				nostrManifestEvent: setup.nostrManifestEvent,
				nostrCapsuleEvent: setup.nostrCapsuleEvent,
				recipientId: setup.recipientId,
				recipientNostrPubkey: setup.recipientNostrPubkey,
				recipientAddress,
				ttlBlocks: ttl,
				currentUtxo: { txId: result.txId, outputIndex: result.outputIndex, amountSats: amount },
				currentTimelockScriptHex: hex.encode(result.timelockScript)
			};
			continuityEnvelope = await encryptBitcoinContinuityKit(continuity, passphrase);
			passphrase = '';
			passphraseConfirmation = '';
		} catch (setupError) {
			error = stored
				? 'Bitcoin setup persisted, but continuity-kit creation failed. Reconciliation and re-enrollment are required.'
				: broadcastSucceeded
					? `Reconciliation required: setup broadcast succeeded but persistence did not complete. ${setupError instanceof Error ? setupError.message : ''}`
					: setupError instanceof Error
						? setupError.message
						: 'Bitcoin setup failed';
			clearSecrets();
		} finally {
			if (branchKeypair) zeroBitcoinKeypair(branchKeypair);
			busy = false;
		}
	}

	function downloadKit(): void {
		if (!continuityEnvelope) return;
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(continuityEnvelope, null, 2)], { type: 'application/json' })
		);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `keyfate-bitcoin-continuity-${secretId}-generation-1.json`;
		anchor.click();
		URL.revokeObjectURL(url);
		kitDownloaded = true;
		clearSecrets();
		oncomplete();
	}
</script>

<div class="border-border space-y-4 rounded-md border p-4">
	<h3 class="font-space font-bold tracking-tight">Fund Bitcoin recovery on Signet</h3>
	<p class="text-muted-foreground text-sm">
		The owner key remains only in this tab. Fund the exact address shown, then discover and confirm
		its outpoint.
	</p>
	{#if error}<Alert.Root variant="destructive"
			><Alert.Description>{error}</Alert.Description></Alert.Root
		>{/if}
	<Button type="button" variant="outline" onclick={generateOwnerAddress} disabled={busy || stored}
		>Generate fresh owner address</Button
	>
	{#if ownerAddress}
		<div class="space-y-2">
			<Label>Owner Signet funding address</Label><Input readonly value={ownerAddress} />
		</div>
		<Button type="button" variant="outline" onclick={discoverFunding} disabled={busy || stored}
			>Discover confirmed outpoints</Button
		>
		{#each utxos as utxo, index (`${utxo.txId}:${utxo.outputIndex}`)}
			<label class="flex items-center gap-2 text-sm"
				><input
					type="radio"
					name="funding-utxo"
					checked={selectedUtxoIndex === index}
					onchange={() => (selectedUtxoIndex = index)}
				/>{utxo.txId}:{utxo.outputIndex} — {utxo.amountSats.toLocaleString()} sats</label
			>
		{/each}
	{/if}
	<div class="grid gap-3 sm:grid-cols-2">
		<div>
			<Label for="recipient-address">Recipient-controlled Signet address</Label><Input
				id="recipient-address"
				bind:value={recipientAddress}
				disabled={stored}
			/>
		</div>
		<div>
			<Label for="recipient-address-confirmation">Confirm recipient address</Label><Input
				id="recipient-address-confirmation"
				bind:value={recipientAddressConfirmation}
				disabled={stored}
			/>
		</div>
		<div>
			<Label for="amount-sats">Amount (sats)</Label><Input
				id="amount-sats"
				type="number"
				bind:value={amountSats}
				disabled={stored}
			/>
		</div>
		<div>
			<Label for="fee-rate">Fee (sat/vB)</Label><Input
				id="fee-rate"
				type="number"
				bind:value={feeRate}
				disabled={stored}
			/>
		</div>
		<div>
			<Label for="ttl-blocks">CSV delay (blocks)</Label><Input
				id="ttl-blocks"
				type="number"
				bind:value={ttlBlocks}
				disabled={stored}
			/>
		</div>
		<div>
			<Label for="bitcoin-kit-passphrase">Continuity passphrase</Label><Input
				id="bitcoin-kit-passphrase"
				type="password"
				bind:value={passphrase}
				disabled={stored}
			/>
		</div>
		<div>
			<Label for="bitcoin-kit-confirmation">Confirm passphrase</Label><Input
				id="bitcoin-kit-confirmation"
				type="password"
				bind:value={passphraseConfirmation}
				disabled={stored}
			/>
		</div>
	</div>
	{#if !stored}
		<Button type="button" onclick={provision} disabled={busy || selectedUtxoIndex < 0}
			>Create, broadcast, encrypt, and store</Button
		>
	{/if}
	{#if continuityEnvelope && !kitDownloaded}
		<Alert.Root
			><Alert.Description
				>Setup is stored, but it is not complete until the encrypted continuity kit is downloaded.</Alert.Description
			></Alert.Root
		>
		<Button type="button" onclick={downloadKit}>Download required continuity kit</Button>
	{/if}
</div>
