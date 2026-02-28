<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { getAmount } from '$lib/pricing';
  import { Check, Crown } from '@lucide/svelte';
  import PaymentMethodSelector from '$lib/components/PaymentMethodSelector.svelte';
  import StripeCheckoutButton from '$lib/components/StripeCheckoutButton.svelte';

  let {
    title,
    description,
    price,
    subtext,
    savingsText,
    features,
    buttonText,
    buttonHref,
    stripeLookupKey,
    billingPeriod,
    isPopular = false,
    class: className = '',
    userTier,
    userTierDisplayName
  }: {
    title: string;
    description: string;
    price: string;
    subtext?: string;
    savingsText?: string;
    features: string[];
    buttonText: string;
    buttonHref?: string;
    stripeLookupKey?: string;
    billingPeriod?: 'monthly' | 'yearly';
    isPopular?: boolean;
    class?: string;
    userTier?: string;
    userTierDisplayName?: string;
  } = $props();
</script>

<Card.Root class="{isPopular ? 'border-primary' : ''} {className} flex flex-col">
  <Card.Header class="pb-8 text-center">
    <div class="flex min-h-[40px] items-center justify-center space-x-2">
      {#if isPopular}
        <Crown class="text-primary h-6 w-6" />
      {/if}
      <Card.Title class="text-2xl">{title}</Card.Title>
      {#if isPopular}
        <Badge class="bg-accent/50 text-accent-foreground dark:bg-accent dark:text-accent-foreground">
          Most Popular
        </Badge>
      {/if}
    </div>
    <div class="space-y-2 md:min-h-[120px]">
      <div class="text-foreground text-4xl font-bold">{price}</div>
      {#if subtext}
        <p class="text-muted-foreground text-sm">{subtext}</p>
      {/if}
      {#if savingsText}
        <p class="text-success text-sm font-medium">{savingsText}</p>
      {/if}
      {#if description}
        <p class="text-muted-foreground">{description}</p>
      {/if}
    </div>
  </Card.Header>

  <Card.Content class="flex flex-1 flex-col space-y-6">
    <ul class="flex-1 space-y-3">
      {#each features as feature}
        <li class="flex items-start space-x-3">
          <Check class="text-success mt-0.5 h-5 w-5 flex-shrink-0" />
          <span class="text-foreground text-sm">{feature}</span>
        </li>
      {/each}
    </ul>

    {#if stripeLookupKey}
      {#if billingPeriod}
        <PaymentMethodSelector
          lookupKey={stripeLookupKey}
          amount={getAmount(billingPeriod === 'monthly' ? 'monthly' : 'yearly')}
          interval={billingPeriod === 'monthly' ? 'monthly' : 'yearly'}
          {userTier}
          {userTierDisplayName}
        />
      {:else}
        <div class="space-y-2">
          <StripeCheckoutButton lookupKey={stripeLookupKey}>
            {buttonText}
          </StripeCheckoutButton>
          <p class="text-muted-foreground text-center text-xs">Sign up or log in to continue</p>
        </div>
      {/if}
    {:else if buttonHref}
      <Button class="w-full" variant={isPopular ? 'default' : 'outline'} href={buttonHref}>
        {buttonText}
      </Button>
    {:else}
      <Button class="w-full" variant={isPopular ? 'default' : 'outline'} disabled>
        {buttonText}
      </Button>
    {/if}
  </Card.Content>
</Card.Root>
