<script lang="ts">
  import NewSecretForm from '$lib/components/NewSecretForm.svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>Create New Secret - KeyFate</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-6 py-12">
  <h1 class="font-space mb-10 text-3xl font-light tracking-tight">Create New Secret</h1>
  {#if data.tierInfo === null}
    <p class="text-muted-foreground">
      Unable to load tier information. Please try again.
    </p>
  {:else}
    <NewSecretForm
      isPaid={data.tierInfo.isPaid}
      tierInfo={{
        secretsUsed: data.tierInfo.secretsUsed,
        secretsLimit: data.tierInfo.secretsLimit,
        canCreate: data.tierInfo.canCreate,
        recipientsLimit: data.tierInfo.recipientsLimit,
      }}
    />
  {/if}
</div>
