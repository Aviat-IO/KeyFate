<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { CreditCard, Bitcoin, CircleCheck } from '@lucide/svelte';
  import StripeCheckoutButton from '$lib/components/StripeCheckoutButton.svelte';

  let {
    amount,
    interval,
    lookupKey,
    userTier,
    userTierDisplayName
  }: {
    amount: number;
    interval: 'monthly' | 'yearly';
    lookupKey: string;
    userTier?: string;
    userTierDisplayName?: string;
  } = $props();

  let showDialog = $state(false);

  const isPaidUser = $derived(userTier && userTier !== 'free');
  const tierName = $derived(userTierDisplayName || userTier || 'Pro');

  function handlePaymentClick(e: MouseEvent) {
    if (isPaidUser) {
      e.preventDefault();
      e.stopPropagation();
      showDialog = true;
    }
  }
</script>

{#if isPaidUser}
  <div class="grid grid-cols-1 gap-3">
    <Button variant="default" class="w-full" onclick={handlePaymentClick}>
      <CreditCard class="mr-2 h-4 w-4" />
      Card
    </Button>

    <Button variant="outline" class="w-full" onclick={handlePaymentClick} disabled>
      <Bitcoin class="mr-2 h-4 w-4" />
      Bitcoin (coming soon)
    </Button>
  </div>

  <Dialog.Root bind:open={showDialog}>
    <Dialog.Content>
      <Dialog.Header>
        <div class="mb-4 flex items-center justify-center">
          <CircleCheck class="h-12 w-12 text-primary" />
        </div>
        <Dialog.Title class="font-space text-center text-xl">You're Already Subscribed!</Dialog.Title>
        <Dialog.Description class="text-center">
          You currently have an active {tierName} subscription. There's no need to subscribe again.
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Footer class="flex flex-col gap-2 sm:flex-col sm:gap-2">
        <Button href="/settings/subscription" class="w-full">Manage Subscription</Button>
        <Button variant="outline" onclick={() => (showDialog = false)} class="w-full">Close</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <div class="grid grid-cols-1 gap-3">
    <StripeCheckoutButton {lookupKey}>
      <CreditCard class="mr-2 h-4 w-4" />
      Card
    </StripeCheckoutButton>

    <Button variant="outline" class="w-full" disabled>
      <Bitcoin class="mr-2 h-4 w-4" />
      Bitcoin (coming soon)
    </Button>
  </div>
{/if}
