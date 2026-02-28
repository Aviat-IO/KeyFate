<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import { Bitcoin, Key, Radio } from '@lucide/svelte';

  type RecoveryMethod = 'nostr' | 'bitcoin' | 'passphrase';

  let {
    selected = $bindable('nostr'),
    availableMethods = ['nostr', 'bitcoin', 'passphrase']
  }: {
    selected: RecoveryMethod;
    availableMethods?: RecoveryMethod[];
  } = $props();

  const methods: Record<
    RecoveryMethod,
    {
      title: string;
      description: string;
      icon: typeof Bitcoin;
      recommended: boolean;
    }
  > = {
    nostr: {
      title: 'Nostr',
      description:
        'Deliver shares via encrypted Nostr direct messages (NIP-17). Recipient needs a Nostr keypair.',
      icon: Radio,
      recommended: true
    },
    bitcoin: {
      title: 'Bitcoin Timelock',
      description:
        'Lock BTC with a CSV timelock. Funds become spendable by the recipient if you stop checking in.',
      icon: Bitcoin,
      recommended: false
    },
    passphrase: {
      title: 'Passphrase',
      description:
        'Encrypt shares with a passphrase that you share with recipients through your own secure channel.',
      icon: Key,
      recommended: false
    }
  };
</script>

<div class="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Recovery method">
  {#each availableMethods as method}
    {@const config = methods[method]}
    <button
      type="button"
      role="radio"
      aria-checked={selected === method}
      onclick={() => (selected = method)}
      class="relative rounded-lg border-2 p-4 text-left transition-colors
        {selected === method
        ? 'border-primary bg-primary/5'
        : 'border-muted hover:border-muted-foreground/30 hover:bg-muted/50'}"
    >
      {#if config.recommended}
        <Badge class="absolute -top-2.5 right-2 text-[10px]">Recommended</Badge>
      {/if}
      <div class="mb-2 flex items-center gap-2">
        <config.icon class="h-5 w-5 {selected === method ? 'text-primary' : 'text-muted-foreground'}" />
        <span class="font-medium">{config.title}</span>
      </div>
      <p class="text-muted-foreground text-xs leading-relaxed">{config.description}</p>
    </button>
  {/each}
</div>
