<script lang="ts">
  import NavBar from '$lib/components/NavBar.svelte';

  let { children, data } = $props();
</script>

<NavBar session={data.session} />
<main>
  {@render children()}
</main>
