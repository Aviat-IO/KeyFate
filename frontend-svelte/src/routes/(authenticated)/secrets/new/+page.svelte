<script lang="ts">
  import NewSecretForm from '$lib/components/NewSecretForm.svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>Create New Secret - KeyFate</title>
</svelte:head>

<div class="mx-auto max-w-3xl py-8 sm:px-4">
  <h1 class="mb-8 text-left text-2xl font-bold">Create New Secret</h1>
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
