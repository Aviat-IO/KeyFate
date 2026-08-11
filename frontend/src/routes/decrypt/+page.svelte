<script lang="ts">
	import NavBar from '$lib/components/NavBar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import SSSDecryptor from '$lib/components/SSSDecryptor.svelte';
</script>

<svelte:head>
	<title>Recover Secret - KeyFate</title>
	<meta
		name="description"
		content="Paste authenticated recovery envelopes locally. Recovery material in URL query parameters is ignored."
	/>
</svelte:head>

<div class="bg-background min-h-screen">
	<div
		class="bg-background/90 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur"
	>
		<NavBar />
	</div>
	<div class="mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-12">
		<div class="w-full max-w-3xl"><SSSDecryptor /></div>
	</div>
	<Footer />
</div>
