<script lang="ts">
  import BillingToggle from '$lib/components/BillingToggle.svelte';
  import PricingCard from '$lib/components/PricingCard.svelte';
  import { TIER_CONFIGS, getLookupKey } from '$lib/constants/tiers';
  import { getPricing, isTestPricing } from '$lib/pricing';
  import { Check } from '@lucide/svelte';

  let {
    class: className = '',
    userTier,
    userTierDisplayName
  }: {
    class?: string;
    userTier?: string;
    userTierDisplayName?: string;
  } = $props();

  let billingPeriod = $state<'monthly' | 'yearly'>('yearly');

  const pricing = getPricing();
  const isTest = isTestPricing();

  const STATIC_PRICING = {
    pro: {
      monthly: {
        price: `$${pricing.monthly}/month`,
        subtext: undefined as string | undefined,
        savingsText: undefined as string | undefined
      },
      yearly: {
        price: `$${(pricing.yearly / 12).toFixed(2)}/month`,
        subtext: `Billed annually at $${pricing.yearly}/year`,
        savingsText: `$${(pricing.monthly * 12 - pricing.yearly).toFixed(2)} saved (${Math.round((1 - pricing.yearly / (pricing.monthly * 12)) * 100)}% off)`
      }
    }
  };

  const proData = $derived(STATIC_PRICING.pro[billingPeriod]);
  const proLookupKey = $derived(
    getLookupKey('pro', billingPeriod === 'monthly' ? 'monthly' : 'annual')
  );
</script>

<div class="space-y-8 {className}">
  <!-- Header -->
  <div class="space-y-4 text-center">
    <h1 class="text-foreground text-4xl font-bold tracking-tight">Choose Your Plan</h1>
    <p class="text-muted-foreground mx-auto max-w-2xl text-xl">
      Secure your digital legacy with KeyFate's dead man's switch service. Start free and upgrade
      when you need more capacity.
    </p>
    {#if isTest}
      <div
        class="bg-warning/10 text-warning border-warning mx-auto max-w-md rounded-lg border p-3"
      >
        <p class="text-sm font-medium">🧪 Test Environment: Using reduced pricing for testing</p>
      </div>
    {/if}
  </div>

  <!-- Billing Period Toggle -->
  <BillingToggle {billingPeriod} onPeriodChange={(p) => (billingPeriod = p)} />

  <!-- Pricing Cards -->
  <div class="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
    <PricingCard
      title="Free"
      description="Perfect for getting started"
      price="$0"
      features={TIER_CONFIGS.free?.features || []}
      buttonText="Get Started"
      buttonHref="/sign-up"
    />

    <PricingCard
      title="Pro"
      description=""
      price={proData.price}
      subtext={proData.subtext}
      savingsText={proData.savingsText}
      features={TIER_CONFIGS.pro?.features || []}
      buttonText="Get Started with Pro"
      stripeLookupKey={proLookupKey || undefined}
      {billingPeriod}
      isPopular={true}
      {userTier}
      {userTierDisplayName}
    />
  </div>

  <!-- FAQ Section -->
  <div class="mx-auto max-w-3xl space-y-8 pt-16">
    <h2 class="text-foreground text-center text-2xl font-bold">Frequently Asked Questions</h2>

    <div class="grid gap-6">
      <div class="space-y-2">
        <h3 class="text-foreground font-semibold">What happens if I exceed my plan limits?</h3>
        <p class="text-muted-foreground text-sm">
          You'll be prompted to upgrade when you reach your limits. Your existing secrets will
          continue to work, but you won't be able to create new ones until you upgrade or remove some
          existing secrets.
        </p>
      </div>

      <div class="space-y-2">
        <h3 class="text-foreground font-semibold">Can I change my plan anytime?</h3>
        <p class="text-muted-foreground text-sm">
          Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately,
          and billing is prorated accordingly.
        </p>
      </div>

      <div class="space-y-2">
        <h3 class="text-foreground font-semibold">What payment methods do you accept?</h3>
        <p class="text-muted-foreground text-sm">
          We accept all major credit cards and other payment methods through our secure payment
          processor Stripe.
        </p>
      </div>

      <div class="space-y-2">
        <h3 class="text-foreground font-semibold">Can I cancel anytime?</h3>
        <p class="text-muted-foreground text-sm">
          Yes, you can cancel your subscription at any time. Your plan will remain active until the
          end of your billing period, then automatically downgrade to the free plan. We also offer a
          30-day money-back guarantee.
          <a href="/refunds" class="text-primary hover:underline">See our refund policy</a>
        </p>
      </div>
    </div>
  </div>

  <!-- Trust Indicators -->
  <div class="space-y-4 border-t pt-8 text-center">
    <p class="text-muted-foreground text-sm">Trusted by thousands of users worldwide</p>
    <div class="text-muted-foreground flex items-center justify-center space-x-8">
      <div class="flex items-center space-x-2">
        <Check class="h-4 w-4" />
        <span class="text-xs">256-bit encryption</span>
      </div>
      <div class="flex items-center space-x-2">
        <Check class="h-4 w-4" />
        <span class="text-xs">SOC 2 compliant</span>
      </div>
      <div class="flex items-center space-x-2">
        <Check class="h-4 w-4" />
        <span class="text-xs">99.9% uptime</span>
      </div>
    </div>
  </div>
</div>
