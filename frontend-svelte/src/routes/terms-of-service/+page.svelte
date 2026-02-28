<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.company} - Terms of Service</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
  <h1 class="mb-8 text-3xl font-bold">Terms of Service</h1>

  <div class="prose prose-gray dark:prose-invert max-w-none space-y-6">
    <p class="text-muted-foreground text-sm"><strong>Effective Date:</strong> January 2, 2025</p>

    <section>
      <h2 class="mb-4 text-2xl font-semibold">1. Agreement to Terms</h2>
      <p>
        These Terms of Service ("Terms") constitute a legally binding agreement between you and
        {data.parentCompany} ("Company," "we," "our," or "us") regarding your use of the
        {data.company} service ("Service") available at {data.siteUrl}.
      </p>
      <p>
        By accessing or using our Service, you agree to be bound by these Terms. If you do not agree
        to these Terms, you may not access or use the Service.
      </p>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold">2. Description of Service</h2>
      <p>{data.company} is a digital dead man's switch platform that allows users to:</p>
      <ul class="list-disc space-y-1 pl-6">
        <li>Create encrypted secrets using Shamir's Secret Sharing technology</li>
        <li>Set check-in schedules to maintain control over their secrets</li>
        <li>Designate recipients who will receive access to secrets if check-ins are missed</li>
        <li>Manage and modify their secrets and check-in preferences</li>
      </ul>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold">3. Eligibility</h2>
      <ul class="list-disc space-y-1 pl-6">
        <li>You must be at least 18 years old to use this Service</li>
        <li>You must provide accurate and complete information when creating an account</li>
        <li>You must have the legal capacity to enter into this agreement</li>
      </ul>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold">4. User Responsibilities</h2>
      <h3 class="mb-2 text-xl font-medium">4.1 Account Security</h3>
      <ul class="list-disc space-y-1 pl-6">
        <li>You are responsible for maintaining the confidentiality of your account credentials</li>
        <li>You must notify us immediately of any unauthorized access to your account</li>
        <li>You are responsible for all activities that occur under your account</li>
      </ul>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold">5. Service Availability and Modifications</h2>
      <ul class="list-disc space-y-1 pl-6">
        <li>We strive to maintain high availability but do not guarantee uninterrupted service</li>
        <li>We may modify, suspend, or discontinue the Service at any time with reasonable notice</li>
      </ul>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold">6. Payment Terms</h2>
      <p>
        {data.company} may offer both free and paid service tiers. All payments are processed securely
        through our payment processor.
      </p>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold">7. Privacy and Data Protection</h2>
      <p>
        Your privacy is important to us. Our collection and use of your information is governed by
        our Privacy Policy.
      </p>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold">8. Disclaimers and Limitation of Liability</h2>
      <div class="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
        <p class="text-foreground mb-2 font-semibold">IMPORTANT DISCLAIMERS:</p>
        <ul class="text-foreground/80 list-disc space-y-1 pl-6">
          <li>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND</li>
          <li>WE DO NOT GUARANTEE THE SECURITY, AVAILABILITY, OR FUNCTIONALITY OF THE SERVICE</li>
          <li>YOU USE THE SERVICE AT YOUR OWN RISK</li>
        </ul>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold">9. Contact Information</h2>
      <div class="bg-muted rounded-lg p-4">
        <p><strong>{data.parentCompany}</strong></p>
        <p>Provo, Utah, United States</p>
        <p>
          Email: <a href="mailto:{data.supportEmail}" class="text-primary hover:underline"
            >{data.supportEmail}</a
          >
        </p>
      </div>
    </section>
  </div>
</div>
