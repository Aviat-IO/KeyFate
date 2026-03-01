<script lang="ts">
  import NavBar from '$lib/components/NavBar.svelte';

  let { children, data } = $props();
</script>

<NavBar session={data.session} />
<main class="mx-auto max-w-5xl px-6 py-12">
  {@render children()}
</main>
