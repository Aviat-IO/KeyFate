<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.company} - Privacy Policy</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-6 py-12">
  <h1 class="font-space mb-8 text-3xl font-light tracking-tight">Privacy Policy</h1>

  <div class="prose prose-gray dark:prose-invert max-w-none space-y-6">
    <p class="text-muted-foreground text-sm"><strong>Effective Date:</strong> January 2, 2025</p>

    <section>
      <h2 class="font-space mb-4 text-xl font-bold tracking-tight">1. Introduction</h2>
      <p>
        {data.parentCompany} ("we," "our," or "us") operates {data.company}, a secure dead man's
        switch platform. This Privacy Policy explains how we collect, use, disclose, and safeguard
        your information when you use our service at {data.siteUrl}.
      </p>
      <p>
        <strong>Our Commitment to Privacy:</strong>
        {data.company} is designed with privacy by design principles. Secret creation and recovery happen
        100% client-side using Shamir's Secret Sharing.
      </p>
    </section>

    <section>
      <h2 class="font-space mb-4 text-xl font-bold tracking-tight">2. Information We Collect</h2>
      <h3 class="mb-2 text-xl font-medium">2.1 Information You Provide</h3>
      <ul class="list-disc space-y-1 pl-6">
        <li><strong>Account Information:</strong> Email address, name (via Google OAuth)</li>
        <li><strong>Recipient Information:</strong> Email addresses of designated recipients</li>
        <li><strong>Secret Metadata:</strong> Titles, check-in frequencies, and configuration settings</li>
      </ul>

      <h3 class="mb-2 text-xl font-medium">2.2 Encrypted Data We Store</h3>
      <ul class="list-disc space-y-1 pl-6">
        <li>
          <strong>One Encrypted Secret Share:</strong> Your secret is split into multiple shares using
          Shamir's Secret Sharing entirely on your device. We receive only one of these shares.
        </li>
      </ul>
    </section>

    <section>
      <h2 class="font-space mb-4 text-xl font-bold tracking-tight">3. How We Use Your Information</h2>
      <ul class="list-disc space-y-1 pl-6">
        <li>Provide and maintain the {data.company} service</li>
        <li>Send check-in reminders via email</li>
        <li>Authenticate your identity and manage your account</li>
        <li>Notify recipients when secrets are triggered</li>
      </ul>
    </section>

    <section>
      <h2 class="font-space mb-4 text-xl font-bold tracking-tight">4. Data Security</h2>
      <ul class="list-disc space-y-1 pl-6">
        <li><strong>100% Client-Side Secret Processing</strong></li>
        <li><strong>Shamir's Secret Sharing</strong></li>
        <li><strong>Server-Side Encryption</strong></li>
        <li><strong>Zero-Knowledge Architecture</strong></li>
      </ul>
    </section>

    <section>
      <h2 class="font-space mb-4 text-xl font-bold tracking-tight">5. Your Rights</h2>
      <ul class="list-disc space-y-1 pl-6">
        <li>Access and update your account information</li>
        <li>Delete your account and associated data</li>
        <li>Pause or modify your secrets</li>
        <li>Export your data (where technically feasible)</li>
      </ul>
      <p>
        To exercise these rights, contact us at
        <a href="mailto:{data.supportEmail}" class="text-primary hover:underline">{data.supportEmail}</a>.
      </p>
    </section>

    <section>
      <h2 class="font-space mb-4 text-xl font-bold tracking-tight">6. Contact Information</h2>
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
