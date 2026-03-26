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

<!-- Unboxed vertical list — secrets separated by thin dividers -->
<div class="divide-y divide-border/50">
  {#each sortedActiveSecrets as secret (secret.id)}
    <SecretCard {secret} />
  {/each}
</div>

{#if sentSecrets.length > 0}
  <div class="mt-16">
    <h2 class="font-space text-2xl font-light tracking-tight">Sent Secrets</h2>
    <div class="mt-4 divide-y divide-border/50">
      {#each sortedSentSecrets as secret (secret.id)}
        <SecretCard {secret} />
      {/each}
    </div>
  </div>
{/if}
