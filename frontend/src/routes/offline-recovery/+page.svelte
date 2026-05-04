<script lang="ts">
	import NavBar from '$lib/components/NavBar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { recoverOfflineSecret } from '$lib/crypto/offline-recovery';
	import { AlertTriangle, Check, Copy, FileText, ShieldCheck, WifiOff } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	let recipientShare = $state('');
	let disclosedShare = $state('');
	let recoveredSecret = $state<string | null>(null);
	let error = $state<string | null>(null);
	let copied = $state(false);

	function recover() {
		error = null;
		recoveredSecret = null;
		copied = false;

		try {
			const result = recoverOfflineSecret(recipientShare, disclosedShare);
			recoveredSecret = result.secret;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Recovery failed. Check both shares and try again.';
		}
	}

	async function copySecret() {
		if (!recoveredSecret) return;

		try {
			await navigator.clipboard.writeText(recoveredSecret);
			copied = true;
			toast.success('Recovered secret copied.');
			setTimeout(() => (copied = false), 2000);
		} catch {
			toast.error('Could not copy to clipboard. Select and copy manually.');
		}
	}
</script>

<svelte:head>
	<title>Offline Recovery Tool - KeyFate</title>
	<meta
		name="description"
		content="Recover a KeyFate secret offline with a recipient share and disclosed server share."
	/>
</svelte:head>

<div class="bg-background min-h-screen">
	<div
		class="bg-background/90 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur"
	>
		<NavBar />
	</div>

	<main class="mx-auto max-w-4xl px-6 py-12">
		<div class="mb-8 space-y-3">
			<div class="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
				<WifiOff class="h-4 w-4" />
				Offline-capable local tool
			</div>
			<h1 class="font-space text-3xl font-light tracking-tight">Offline KeyFate Recovery</h1>
			<p class="text-muted-foreground max-w-2xl">
				Use this page to combine your recipient share with the disclosed KeyFate server share.
				Decryption happens in this browser only. No network request is needed after the page loads.
			</p>
		</div>

		<Alert.Root class="mb-6">
			<ShieldCheck class="h-4 w-4" />
			<Alert.Title>For sensitive secrets, disconnect first</Alert.Title>
			<Alert.Description>
				Open this page, turn off Wi-Fi or unplug the network cable, then paste the two shares.
				Close the tab when finished. Do not paste shares into chats, email, or search engines.
			</Alert.Description>
		</Alert.Root>

		<div class="grid gap-6 md:grid-cols-2">
			<section class="space-y-3 rounded-lg border p-4">
				<div class="flex items-center gap-2">
					<FileText class="h-4 w-4" />
					<h2 class="font-space text-xl font-semibold">1. Recipient share</h2>
				</div>
				<p class="text-muted-foreground text-sm">
					Paste the share originally sent to you. Raw hex is accepted. JSON recovery kits with a
					<code class="bg-muted rounded px-1">share</code> or
					<code class="bg-muted rounded px-1">recipientShare</code> field also work.
				</p>
				<Textarea
					bind:value={recipientShare}
					rows={8}
					class="font-mono text-sm"
					placeholder="Paste recipient share hex or JSON here"
				/>
			</section>

			<section class="space-y-3 rounded-lg border p-4">
				<div class="flex items-center gap-2">
					<FileText class="h-4 w-4" />
					<h2 class="font-space text-xl font-semibold">2. Disclosed server share</h2>
				</div>
				<p class="text-muted-foreground text-sm">
					Paste the server share disclosed by KeyFate after the owner's missed check-ins. Raw hex
					or JSON with <code class="bg-muted rounded px-1">serverShare</code> /
					<code class="bg-muted rounded px-1">disclosedShare</code> is accepted.
				</p>
				<Textarea
					bind:value={disclosedShare}
					rows={8}
					class="font-mono text-sm"
					placeholder="Paste disclosed server share hex or JSON here"
				/>
			</section>
		</div>

		<Button class="mt-6 w-full" size="lg" onclick={recover}>Recover Secret Locally</Button>

		{#if error}
			<Alert.Root variant="destructive" class="mt-6">
				<AlertTriangle class="h-4 w-4" />
				<Alert.Title>Recovery failed</Alert.Title>
				<Alert.Description>{error}</Alert.Description>
			</Alert.Root>
		{/if}

		{#if recoveredSecret}
			<Alert.Root class="mt-6 border-accent bg-accent/50">
				<ShieldCheck class="text-accent-foreground h-4 w-4" />
				<Alert.Title class="text-accent-foreground">Secret recovered</Alert.Title>
				<Alert.Description class="space-y-3">
					<p class="text-accent-foreground/90">
						Copy it only to the intended secure destination. Clear your clipboard afterward.
					</p>
					<Textarea
						value={recoveredSecret}
						readonly
						rows={5}
						class="bg-muted font-mono text-sm select-all"
					/>
					<Button variant={copied ? 'default' : 'outline'} size="sm" onclick={copySecret}>
						{#if copied}
							<Check class="mr-2 h-4 w-4" /> Copied
						{:else}
							<Copy class="mr-2 h-4 w-4" /> Copy recovered secret
						{/if}
					</Button>
				</Alert.Description>
			</Alert.Root>
		{/if}
	</main>

	<Footer />
</div>
