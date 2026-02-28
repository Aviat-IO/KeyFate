<script lang="ts">
  import SecretCard from '$lib/components/SecretCard.svelte';
  import type { SecretWithRecipients } from '$lib/types/secret-types';

  let { secrets }: { secrets: SecretWithRecipients[] } = $props();

  let activeSecrets = $derived(
    secrets.filter((s) => s.status !== 'triggered' && !s.triggeredAt)
  );
  let sentSecrets = $derived(
    secrets.filter((s) => s.status === 'triggered' || s.triggeredAt)
  );

  let sortedActiveSecrets = $derived(
    [...activeSecrets].sort((a, b) => {
      if (!a.nextCheckIn) return 1;
      if (!b.nextCheckIn) return -1;
      return new Date(a.nextCheckIn).getTime() - new Date(b.nextCheckIn).getTime();
    })
  );

  let sortedSentSecrets = $derived(
    [...sentSecrets].sort((a, b) => {
      if (!a.triggeredAt) return 1;
      if (!b.triggeredAt) return -1;
      return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime();
    })
  );
</script>

<div class="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-4 lg:gap-6 xl:grid-cols-3">
  {#each sortedActiveSecrets as secret (secret.id)}
    <SecretCard {secret} />
  {/each}
</div>

{#if sentSecrets.length > 0}
  <div class="mt-12">
    <h2 class="mb-6 text-2xl font-bold">Sent Secrets</h2>
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-4 lg:gap-6 xl:grid-cols-3">
      {#each sortedSentSecrets as secret (secret.id)}
        <SecretCard {secret} />
      {/each}
    </div>
  </div>
{/if}
