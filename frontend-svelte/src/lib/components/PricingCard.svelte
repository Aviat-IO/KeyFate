<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
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

<div class="flex flex-col {className}">
  <div class="pb-8 text-center">
    <div class="flex min-h-[40px] items-center justify-center space-x-2">
      {#if isPopular}
        <Crown class="text-primary h-5 w-5" />
      {/if}
      <h3 class="font-space text-xl font-bold uppercase tracking-wider">{title}</h3>
      {#if isPopular}
        <Badge variant="outline" class="text-xs uppercase tracking-wider">
          Most Popular
        </Badge>
      {/if}
    </div>
    <div class="mt-4 space-y-2 md:min-h-[120px]">
      <div class="font-space text-4xl font-light tracking-tight">{price}</div>
      {#if subtext}
        <p class="text-muted-foreground text-sm">{subtext}</p>
      {/if}
      {#if savingsText}
        <p class="text-success text-sm font-medium">{savingsText}</p>
      {/if}
      {#if description}
        <p class="text-muted-foreground text-sm">{description}</p>
      {/if}
    </div>
  </div>

  <div class="flex flex-1 flex-col space-y-6">
    <ul class="flex-1 space-y-3">
      {#each features as feature}
        <li class="flex items-start space-x-3">
          <Check class="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
          <span class="text-sm text-muted-foreground">{feature}</span>
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
      <Button class="w-full uppercase tracking-wide font-semibold" variant={isPopular ? 'default' : 'outline'} href={buttonHref}>
        {buttonText}
      </Button>
    {:else}
      <Button class="w-full uppercase tracking-wide font-semibold" variant={isPopular ? 'default' : 'outline'} disabled>
        {buttonText}
      </Button>
    {/if}
  </div>
</div>
