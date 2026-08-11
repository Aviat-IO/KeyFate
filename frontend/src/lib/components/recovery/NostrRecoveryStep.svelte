<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Alert from '$lib/components/ui/alert';
	import { Textarea } from '$lib/components/ui/textarea';
	import { toast } from 'svelte-sonner';
	import { AlertTriangle, CheckCircle, Eye, EyeOff, Loader2, Search } from '@lucide/svelte';
	import {
		isValidNsec,
		nsecToSecretKey,
		type DecryptedShareResult
	} from '$lib/crypto/recovery-flows';
	import { createNostrClient } from '$lib/nostr/client';
	import { DEFAULT_RELAYS } from '$lib/nostr/relay-config';
	import { publicKeyFromSecret } from '$lib/nostr/keypair';
	import { parseRecoveryShareEnvelope } from '$lib/crypto/recovery-v3';
	import {
		parseRecoverySetupBundleV3,
		unwrapRecoveryArtifactV3
	} from '$lib/nostr/recovery-v3-artifact';

	interface Props {
		onComplete: (results: DecryptedShareResult[]) => void;
		onError: (message: string) => void;
	}
	let { onComplete, onError }: Props = $props();
	let setupBundleInput = $state('');
	let nsecInput = $state('');
	let nsecVisible = $state(false);
	let recovering = $state(false);
	let recovered = $state(false);
	let nsecValid = $derived(nsecInput.trim().length > 0 && isValidNsec(nsecInput.trim()));
	let bundleValid = $derived.by(() => {
		if (!setupBundleInput.trim()) return false;
		try {
			parseRecoverySetupBundleV3(setupBundleInput.trim());
			return true;
		} catch {
			return false;
		}
	});
	let canRecover = $derived(nsecValid && bundleValid && !recovering && !recovered);

	async function importBundleFile(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > 300_000) {
			onError('Setup bundle exceeds maximum size');
			return;
		}
		setupBundleInput = await file.text();
	}

	async function recoverFromNostr() {
		if (!canRecover) return;
		onError('');
		recovering = true;
		const secretKey = nsecToSecretKey(nsecInput.trim());
		try {
			const { bundle, manifest } = parseRecoverySetupBundleV3(setupBundleInput.trim());
			if (publicKeyFromSecret(secretKey) !== manifest.recipientNostrPubkey)
				throw new Error('The supplied nsec does not match the owner-delivered setup bundle');
			const relays = [...new Set([...bundle.relayHints, ...DEFAULT_RELAYS])];
			const client = createNostrClient({ relays });
			try {
				const events = await client.query({
					ids: [manifest.giftWrapEventId],
					kinds: [1059],
					'#p': [manifest.recipientNostrPubkey]
				});
				const exactEvent = events.find((event) => event.id === manifest.giftWrapEventId);
				if (!exactEvent) {
					throw new Error(
						'The exact setup-bundle-pinned artifact was not found on signed or configured relays; retry remains safe'
					);
				}
				const share = unwrapRecoveryArtifactV3({
					giftWrapEvent: exactEvent,
					recipientSecretKey: secretKey,
					setupBundle: bundle
				});
				const envelope = parseRecoveryShareEnvelope(share);
				onComplete([
					{
						share,
						shareIndex: envelope.index,
						threshold: envelope.threshold,
						totalShares: envelope.total,
						secretId: manifest.secretId
					}
				]);
				recovered = true;
				nsecInput = '';
				toast.success('Authenticated recovery envelope decrypted');
			} finally {
				client.close();
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown recovery error';
			onError(`Authenticated Nostr v3 recovery failed: ${message}`);
			toast.error('Nostr recovery failed');
		} finally {
			secretKey.fill(0);
			recovering = false;
		}
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="font-space text-xl font-bold tracking-tight">Authenticated Nostr Recovery</h2>
		<p class="text-muted-foreground mt-1 text-sm">
			Import the setup bundle the owner delivered before disclosure. A server-supplied replacement
			manifest is not trusted.
		</p>
	</div>
	<div class="space-y-2">
		<Label for="setup-bundle-file">Owner-delivered setup bundle</Label>
		<input
			id="setup-bundle-file"
			type="file"
			accept="application/json,.json"
			onchange={importBundleFile}
			class="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
		/>
		<Label for="setup-bundle-input">Or paste setup bundle JSON</Label>
		<Textarea
			id="setup-bundle-input"
			bind:value={setupBundleInput}
			class="font-mono text-xs"
			rows={7}
			autocomplete="off"
			spellcheck={false}
		/>
		{#if setupBundleInput.trim() && !bundleValid}<p class="text-destructive text-xs">
				The setup bundle, signed manifest, or strict v3 schema is invalid.
			</p>{/if}
	</div>
	<div class="space-y-2">
		<Label for="nsec-input">Recipient Nostr Private Key (nsec)</Label>
		<Alert.Alert variant="destructive"
			><AlertTriangle class="h-4 w-4" /><Alert.AlertDescription class="text-xs"
				>The nsec is used locally by trusted page code and is cleared after recovery. Browser
				extensions or a compromised origin could still observe it.</Alert.AlertDescription
			></Alert.Alert
		>
		<div class="relative">
			<Textarea
				id="nsec-input"
				placeholder="nsec1..."
				bind:value={nsecInput}
				class="pr-10 font-mono text-sm"
				rows={2}
				autocomplete="off"
				spellcheck={false}
				style={nsecVisible ? '' : '-webkit-text-security: disc; text-security: disc;'}
			/><button
				type="button"
				onclick={() => (nsecVisible = !nsecVisible)}
				class="text-muted-foreground hover:text-foreground absolute top-2 right-2 p-1"
				aria-label={nsecVisible ? 'Hide private key' : 'Show private key'}
				>{#if nsecVisible}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}</button
			>
		</div>
		{#if nsecInput.trim() && !nsecValid}<p class="text-destructive text-xs">
				Enter a valid nsec.
			</p>{/if}
	</div>
	<Button onclick={recoverFromNostr} disabled={!canRecover} class="w-full"
		>{#if recovering}<Loader2 class="mr-2 h-4 w-4 animate-spin" /> Fetching exact pinned event…{:else if recovered}<CheckCircle
				class="mr-2 h-4 w-4"
			/> Envelope recovered{:else}<Search class="mr-2 h-4 w-4" /> Fetch, verify, and recover envelope{/if}</Button
	>
	<p class="text-muted-foreground text-xs">
		Recovery queries the signed relay hints and alternate KeyFate-configured relays only for the
		exact pinned event ID and recipient. Retry cannot accept a substitute. It verifies the manifest,
		outer gift wrap, seal, rumor, capsule, publisher, secret, set, share index, threshold, and
		ciphertext digest before returning a v3 envelope.
	</p>
</div>
