<script lang="ts">
  import { clientEnv } from '$lib/client-env';
  import { AlertTriangle, CheckCircle, Clock, RefreshCw, Shield } from 'lucide-svelte';

  const supportEmail = clientEnv.SUPPORT_EMAIL;
</script>

<svelte:head>
  <title>Refund Policy - KeyFate</title>
</svelte:head>

<div class="mx-auto max-w-3xl">
  <!-- Header -->
  <div class="mb-16 space-y-4">
    <h1 class="font-space text-3xl font-light tracking-tight">Refund Policy</h1>
    <p class="text-muted-foreground max-w-2xl text-lg">
      We want you to be completely satisfied with KeyFate. Our refund policy is designed to be fair
      and transparent.
    </p>
  </div>

  <div class="space-y-12">
    <!-- Quick Overview -->
    <section>
      <div class="flex items-center gap-2 mb-4">
        <CheckCircle class="text-primary h-5 w-5" />
        <h2 class="font-space text-xl font-bold tracking-tight">30-Day Money-Back Guarantee</h2>
      </div>
      <p class="text-muted-foreground">
        We offer a full 30-day money-back guarantee for all Pro subscriptions. If you're not
        satisfied for any reason, we'll provide a complete refund.
      </p>
    </section>

    <!-- Eligibility -->
    <section>
      <div class="flex items-center gap-2 mb-6">
        <Shield class="text-primary h-5 w-5" />
        <h2 class="font-space text-xl font-bold tracking-tight">Refund Eligibility</h2>
      </div>
      <div class="space-y-4">
        <div class="flex items-start space-x-3">
          <CheckCircle class="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <h4 class="font-medium">Pro Subscriptions</h4>
            <p class="text-muted-foreground text-sm">
              Full refund available within 30 days of purchase for both monthly and annual plans
            </p>
          </div>
        </div>
        <div class="flex items-start space-x-3">
          <CheckCircle class="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <h4 class="font-medium">Unused Portions</h4>
            <p class="text-muted-foreground text-sm">
              For annual subscriptions cancelled after 30 days, we'll refund the unused portion
              (prorated)
            </p>
          </div>
        </div>
        <div class="flex items-start space-x-3">
          <CheckCircle class="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <h4 class="font-medium">Billing Errors</h4>
            <p class="text-muted-foreground text-sm">
              Immediate full refund for any billing errors or duplicate charges
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Timeline -->
    <section>
      <div class="flex items-center gap-2 mb-6">
        <Clock class="text-muted-foreground h-5 w-5" />
        <h2 class="font-space text-xl font-bold tracking-tight">Refund Timeline</h2>
      </div>
      <div class="space-y-4">
        <div class="border-primary border-l-2 pl-4">
          <h4 class="font-medium">Within 30 Days</h4>
          <p class="text-muted-foreground text-sm">
            Full refund, no questions asked. Perfect if KeyFate isn't the right fit for you.
          </p>
        </div>
        <div class="border-muted-foreground/30 border-l-2 pl-4">
          <h4 class="font-medium">31-365 Days (Annual Plans)</h4>
          <p class="text-muted-foreground text-sm">
            Prorated refund for the unused portion of your annual subscription.
          </p>
        </div>
        <div class="border-muted border-l-2 pl-4">
          <h4 class="text-muted-foreground font-medium">Monthly Plans After 30 Days</h4>
          <p class="text-muted-foreground text-sm">
            You can cancel anytime to avoid future charges. Current month is non-refundable.
          </p>
        </div>
      </div>
    </section>

    <!-- How to Request -->
    <section>
      <div class="flex items-center gap-2 mb-6">
        <RefreshCw class="text-muted-foreground h-5 w-5" />
        <h2 class="font-space text-xl font-bold tracking-tight">How to Request a Refund</h2>
      </div>
      <ol class="list-inside list-decimal space-y-3">
        <li class="text-sm">
          <span class="font-medium">Contact Support:</span> Email us at
          <a
            href="mailto:{supportEmail}"
            class="text-primary hover:text-primary/90 hover:underline">{supportEmail}</a
          >
        </li>
        <li class="text-sm">
          <span class="font-medium">Provide Details:</span> Include your account email, subscription
          details, and reason for the refund request
        </li>
        <li class="text-sm">
          <span class="font-medium">Processing:</span> We'll process eligible refunds within 3-5 business
          days and notify you once complete
        </li>
        <li class="text-sm">
          <span class="font-medium">Receive Refund:</span> Refunds are issued to your original payment
          method and typically appear within 5-10 business days
        </li>
      </ol>
    </section>

    <!-- Special Circumstances -->
    <section>
      <div class="flex items-center gap-2 mb-6">
        <AlertTriangle class="text-muted-foreground h-5 w-5" />
        <h2 class="font-space text-xl font-bold tracking-tight">Special Circumstances</h2>
      </div>
      <div class="space-y-4">
        <div>
          <h4 class="font-medium">Service Disruption</h4>
          <p class="text-muted-foreground text-sm">
            If our service is unavailable for more than 24 hours due to technical issues, we'll
            provide credits or refunds for the affected period.
          </p>
        </div>
        <div>
          <h4 class="font-medium">Data Loss</h4>
          <p class="text-muted-foreground text-sm">
            In the unlikely event of data loss due to our systems, we'll provide a full refund and
            work to recover your information.
          </p>
        </div>
        <div>
          <h4 class="font-medium">Account Termination</h4>
          <p class="text-muted-foreground text-sm">
            If we terminate your account for violations of our terms, refunds will be considered on
            a case-by-case basis.
          </p>
        </div>
      </div>
    </section>

    <!-- What Happens After Refund -->
    <section>
      <h2 class="font-space mb-6 text-xl font-bold tracking-tight">What Happens After a Refund</h2>
      <div class="space-y-3">
        {#each ['Your account will be downgraded to the Free plan immediately', "You'll keep access to 1 secret and 1 recipient per secret (Free plan limits)", "Your existing secrets will continue to work, but you won't be able to create new ones beyond the free limit", 'You can upgrade again anytime to regain full Pro features'] as item}
          <div class="flex items-start space-x-3">
            <div class="bg-primary mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full"></div>
            <p class="text-muted-foreground text-sm">{item}</p>
          </div>
        {/each}
      </div>
    </section>

    <!-- Contact Information -->
    <section>
      <h2 class="font-space mb-4 text-xl font-bold tracking-tight">Need Help?</h2>
      <p class="text-muted-foreground mb-4 text-sm">
        If you have questions about our refund policy or need assistance with your subscription,
        we're here to help.
      </p>
      <div class="space-y-2">
        <div class="flex items-center space-x-2">
          <span class="text-xs text-muted-foregroundr font-medium">Email</span>
          <a
            href="mailto:{supportEmail}"
            class="text-primary hover:text-primary/90 text-sm hover:underline">{supportEmail}</a
          >
        </div>
        <div class="flex items-center space-x-2">
          <span class="text-xs text-muted-foregroundr font-medium">Response Time</span>
          <span class="text-sm">Within 24 hours</span>
        </div>
      </div>
      <div class="border-t border-border mt-8 pt-6">
        <a href="/pricing" class="text-primary hover:text-primary/90 text-sm hover:underline">
          &larr; Back to Pricing
        </a>
      </div>
    </section>
  </div>
</div>
