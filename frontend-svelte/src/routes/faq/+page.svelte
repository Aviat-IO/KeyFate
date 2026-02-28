<script lang="ts">
  import { page } from '$app/stores';
  import NavBar from '$lib/components/NavBar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import * as Accordion from '$lib/components/ui/accordion';
  import { Shield, Lock, Clock, Users, Download, Globe } from 'lucide-svelte';

  let session = $derived($page.data.session);

  const faqs = [
    {
      category: 'Security & Privacy',
      icon: Shield,
      questions: [
        { question: 'Can KeyFate read my secrets?', answer: "No, mathematically impossible. Your secrets are encrypted client-side using Shamir's Secret Sharing before anything leaves your browser. We only store ONE encrypted share out of the required threshold (e.g., 2-of-3). This single share is useless on its own." },
        { question: "How does Shamir's Secret Sharing work?", answer: "Shamir's Secret Sharing is a cryptographic algorithm that splits a secret into multiple pieces (shares). You configure a threshold – for example, 2-of-3 means the secret is split into 3 shares, and any 2 are needed to reconstruct it. KeyFate stores 1 share, you keep 1, and your recipient gets 1." },
        { question: 'What encryption does KeyFate use?', answer: "We use AES-256-GCM for encrypting shares (the same standard used by governments and militaries), combined with Shamir's Secret Sharing for splitting secrets. All cryptographic operations happen in your browser using proven, open-source libraries." },
      ],
    },
    {
      category: 'Business Continuity',
      icon: Globe,
      questions: [
        { question: 'What happens if KeyFate goes out of business?', answer: "This is a legitimate concern, and we've designed for it. Your secrets are YOURS – we only hold one share. We're committed to providing share export functionality, 90+ days notice if we ever shut down, and open-sourcing our reconstruction tools." },
        { question: "What if KeyFate's servers go down temporarily?", answer: 'Our infrastructure runs on Google Cloud with multiple redundancy layers. We send 7 reminder emails before any deadline. Any reminders missed during an outage are automatically retried within a 7-day window.' },
        { question: 'Can I export my data and shares?', answer: 'Yes! We believe in data sovereignty. You can export your server-stored share as an encrypted backup file. With all shares in hand, you can reconstruct your secret using our open-source tools.' },
        { question: 'Is KeyFate open source?', answer: "Our cryptographic libraries and reconstruction tools are open source. We're committed to transparency in how your data is protected." },
      ],
    },
    {
      category: 'How It Works',
      icon: Lock,
      questions: [
        { question: 'How do check-ins work?', answer: 'You choose a check-in interval (from 1 day to 3 years for Pro users). We send reminder emails before your deadline. One click confirms you\'re okay. If you miss ALL reminders and the deadline, we disclose your server share to your recipient.' },
        { question: "What does my recipient receive if I don't check in?", answer: "Your recipient receives our encrypted share plus instructions for combining it with their share. They'll need both pieces to reconstruct your secret." },
        { question: 'Can I have multiple secrets and recipients?', answer: 'Free tier: 1 secret with 1 recipient. Pro tier: Up to 10 secrets with 5 recipients each. Each secret can have its own check-in schedule, threshold configuration, and custom message.' },
      ],
    },
    {
      category: 'Account & Billing',
      icon: Users,
      questions: [
        { question: "What's included in the free tier?", answer: '1 secret, 1 recipient, 3 check-in intervals (1 week, 1 month, 1 year), and 2-of-3 share threshold.' },
        { question: 'What do I get with Pro?', answer: '10 secrets, 5 recipients per secret, 9 flexible intervals (1 day to 3 years), configurable thresholds (2-of-N up to 7 shares), 7 message templates, comprehensive audit logs, and priority support.' },
        { question: 'What happens if I downgrade from Pro to Free?', answer: "Your existing secrets are grandfathered – they stay active and continue working. You just can't create new secrets if you're over the free tier limit." },
        { question: 'Do you offer refunds?', answer: "Yes, we offer a 30-day money-back guarantee. If KeyFate isn't right for you, contact support for a full refund." },
      ],
    },
    {
      category: 'Future Features',
      icon: Clock,
      questions: [
        { question: "What's on your roadmap?", answer: "We're actively working on: Share export/backup functionality, Nostr integration for censorship-resistant disclosure, Offline reconstruction tools, SMS notifications, Multi-provider storage redundancy." },
        { question: 'What is Nostr integration?', answer: "Nostr is a decentralized protocol for censorship-resistant communication. We're building integration that allows secret disclosure through the Nostr network." },
      ],
    },
  ];
</script>

<svelte:head>
  <title>FAQ - KeyFate</title>
  <meta name="description" content="Frequently asked questions about KeyFate's dead man's switch service, security, and business continuity." />
</svelte:head>

<div class="bg-background min-h-screen">
  <nav class="fixed left-0 right-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
    <NavBar {session} />
  </nav>

  <div class="h-16"></div>

  <section class="container mx-auto px-4 py-16">
    <div class="mx-auto max-w-4xl">
      <div class="mb-12 text-center">
        <Badge variant="outline" class="mb-4">
          <Shield class="mr-2 h-3 w-3" />
          Frequently Asked Questions
        </Badge>
        <h1 class="mb-4 text-4xl font-bold tracking-tight md:text-5xl">How can we help?</h1>
        <p class="text-muted-foreground text-lg">
          Everything you need to know about KeyFate's security, features, and how we protect your digital legacy.
        </p>
      </div>

      <Card.Root class="mb-8 border-primary/20 bg-primary/5">
        <Card.Content class="pt-6">
          <div class="flex items-start gap-4">
            <Download class="text-primary mt-1 h-6 w-6 flex-shrink-0" />
            <div>
              <h3 class="mb-2 font-semibold">Your Secrets, Your Control</h3>
              <p class="text-muted-foreground text-sm">
                KeyFate is designed so you're never locked in. We store only what's mathematically useless alone, you can export your data anytime, and our reconstruction tools are open source.
              </p>
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <div class="space-y-8">
        {#each faqs as category}
          <div>
            <div class="mb-4 flex items-center gap-2">
              <category.icon class="text-primary h-5 w-5" />
              <h2 class="text-xl font-semibold">{category.category}</h2>
            </div>
            <Accordion.Root type="single" class="w-full">
              {#each category.questions as faq, index}
                <Accordion.Item value="{category.category}-{index}">
                  <Accordion.Trigger class="text-left">{faq.question}</Accordion.Trigger>
                  <Accordion.Content class="text-muted-foreground">{faq.answer}</Accordion.Content>
                </Accordion.Item>
              {/each}
            </Accordion.Root>
          </div>
        {/each}
      </div>

      <Card.Root class="mt-12 text-center">
        <Card.Content class="pt-6">
          <h3 class="mb-2 font-semibold">Still have questions?</h3>
          <p class="text-muted-foreground mb-4 text-sm">Can't find what you're looking for? We're here to help.</p>
          <a href="mailto:support@keyfate.com" class="text-primary hover:underline">Contact Support &rarr;</a>
        </Card.Content>
      </Card.Root>
    </div>
  </section>

  <Footer />
</div>
