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
		unwrapGiftWrap,
		type DecryptedShareResult
	} from '$lib/crypto/recovery-flows';
	import { createNostrClient } from '$lib/nostr/client';
	import { publicKeyFromSecret } from '$lib/nostr/keypair';
	import { DEFAULT_RELAYS } from '$lib/nostr/relay-config';
	import { parseVerifiedManifestJson } from '$lib/nostr/recovery-capsule';

	interface Props {
		onComplete: (results: DecryptedShareResult[]) => void;
		onError: (message: string) => void;
	}
	let { onComplete, onError }: Props = $props();
	let manifestInput = $state('');
	let nsecInput = $state('');
	let nsecVisible = $state(false);
	let recovering = $state(false);
	let recovered = $state(false);
	const manifestPlaceholder = '{"id":"…","pubkey":"…","kind":21061,"content":"…"}';
	let nsecValid = $derived(nsecInput.trim().length > 0 && isValidNsec(nsecInput.trim()));
	let manifestValid = $derived.by(() => {
		if (!manifestInput.trim()) return false;
		try {
			parseVerifiedManifestJson(manifestInput.trim());
			return true;
		} catch {
			return false;
		}
	});
	let canRecover = $derived(nsecValid && manifestValid && !recovering && !recovered);

	async function recoverFromNostr() {
		if (!canRecover) return;
		onError('');
		recovering = true;
		const secretKey = nsecToSecretKey(nsecInput.trim());
		try {
			const { event: manifestEvent, content: manifest } = parseVerifiedManifestJson(
				manifestInput.trim()
			);
			if (publicKeyFromSecret(secretKey) !== manifest.recipientNostrPubkey) {
				throw new Error('The supplied nsec does not match the signed legacy manifest');
			}
			const client = createNostrClient({ relays: [...DEFAULT_RELAYS] });
			try {
				const events = await client.query({
					ids: [manifest.giftWrapEventId],
					kinds: [1059],
					'#p': [manifest.recipientNostrPubkey]
				});
				const giftWrap = events.find((event) => event.id === manifest.giftWrapEventId);
				if (!giftWrap) throw new Error('The signed legacy artifact was not found on a relay');
				const share = unwrapGiftWrap(giftWrap, secretKey, manifestEvent);
				onComplete([
					{
						share: share.share,
						shareIndex: share.shareIndex,
						threshold: share.threshold,
						totalShares: share.totalShares,
						secretId: share.secretId
					}
				]);
				recovered = true;
				nsecInput = '';
				toast.warning('Unverified legacy recovery share interpolated');
			} finally {
				client.close();
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown recovery error';
			onError(`Unverified legacy Nostr recovery failed: ${message}`);
			toast.error('Legacy Nostr recovery failed');
		} finally {
			secretKey.fill(0);
			recovering = false;
		}
	}
</script>

<div class="space-y-6">
	<Alert.Alert variant="destructive">
		<AlertTriangle class="h-4 w-4" />
		<Alert.AlertTitle>Unverified legacy Nostr recovery</Alert.AlertTitle>
		<Alert.AlertDescription>
			This v2 flow trusts the disclosure-time self-signed manifest and cannot detect owner-publisher
			substitution. Use only for existing legacy records. It is never selected as a fallback from
			v3.
		</Alert.AlertDescription>
	</Alert.Alert>
	<div class="space-y-2">
		<Label for="legacy-manifest-input">Legacy signed recovery manifest</Label>
		<Textarea
			id="legacy-manifest-input"
			placeholder={manifestPlaceholder}
			bind:value={manifestInput}
			class="font-mono text-xs"
			rows={6}
			autocomplete="off"
			spellcheck={false}
		/>
		{#if manifestInput.trim() && !manifestValid}
			<p class="text-destructive text-xs">The legacy manifest signature or schema is invalid.</p>
		{/if}
	</div>
	<div class="space-y-2">
		<Label for="legacy-nsec-input">Recipient Nostr Private Key (nsec)</Label>
		<div class="relative">
			<Textarea
				id="legacy-nsec-input"
				placeholder="nsec1..."
				bind:value={nsecInput}
				class="pr-10 font-mono text-sm"
				rows={2}
				autocomplete="off"
				spellcheck={false}
				style={nsecVisible ? '' : '-webkit-text-security: disc; text-security: disc;'}
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
	<Button onclick={recoverFromNostr} disabled={!canRecover} class="w-full">
		{#if recovering}<Loader2 class="mr-2 h-4 w-4 animate-spin" /> Fetching legacy artifact…{:else if recovered}<CheckCircle
				class="mr-2 h-4 w-4"
			/> Legacy share recovered{:else}<Search class="mr-2 h-4 w-4" /> Run unverified legacy recovery{/if}
	</Button>
</div>
