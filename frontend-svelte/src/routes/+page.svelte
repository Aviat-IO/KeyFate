<script lang="ts">
  import { page } from '$app/stores';
  import NavBar from '$lib/components/NavBar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import {
    Clock,
    Lock,
    Shield,
    FileText,
    Key,
    Users,
    CheckCircle,
    Eye,
    EyeOff,
    ArrowRight,
    Zap,
    Globe,
  } from 'lucide-svelte';

  let session = $derived($page.data.session);
  let scrollY = $state(0);
</script>

<svelte:window bind:scrollY />

<div class="bg-background min-h-screen">
  <nav
    class="fixed left-0 right-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
  >
    <NavBar {session} />
  </nav>

  <div class="h-16"></div>

  <!-- Hero Section -->
  <section class="container relative mx-auto overflow-hidden px-4 py-32">
    <div class="absolute inset-0 opacity-5" style="transform: translateY({scrollY * 0.3}px)">
      <div class="bg-primary/20 absolute left-1/4 top-1/4 h-96 w-96 rounded-full blur-3xl"></div>
      <div
        class="bg-secondary/30 absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full blur-2xl"
      ></div>
    </div>

    <div class="relative z-10 mx-auto max-w-5xl text-center">
      <Badge variant="outline" class="mb-6 text-sm">
        <Shield class="mr-2 h-3 w-3" />
        Zero-knowledge security
      </Badge>

      <h1 class="mb-8 text-5xl font-bold tracking-tight md:text-7xl">
        Your Digital
        <span class="text-primary relative">
          Legacy
          <div class="bg-primary/30 absolute -bottom-2 left-0 right-0 h-1 rounded-full"></div>
        </span>
        Protected
      </h1>

      <p class="text-muted-foreground my-12 text-xl leading-relaxed md:text-2xl">
        Securely share critical information with trusted contacts if you become unavailable.
        <br />
        <span class="text-foreground font-medium">
          Perfect for crypto keys, sensitive documents, and estate planning.
        </span>
      </p>

      <div class="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Button size="lg" class="px-8 py-6 text-lg" href="/auth/signin">
          Start Protecting Your Secrets
          <ArrowRight class="ml-2 h-5 w-5" />
        </Button>
        <Button variant="outline" size="lg" class="px-8 py-6 text-lg" href="#how-it-works">
          See How It Works
        </Button>
      </div>

      <div class="text-muted-foreground flex flex-wrap items-center justify-center gap-8 text-sm">
        <div class="flex items-center gap-2">
          <CheckCircle class="text-accent-foreground h-4 w-4" />
          <span>Client-side encryption</span>
        </div>
        <div class="flex items-center gap-2">
          <CheckCircle class="text-accent-foreground h-4 w-4" />
          <span>Zero-knowledge architecture</span>
        </div>
        <div class="flex items-center gap-2">
          <CheckCircle class="text-accent-foreground h-4 w-4" />
          <span>Open source cryptography</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Use Cases Section -->
  <section class="bg-muted/30 container mx-auto px-4 py-24">
    <div class="mb-16 text-center">
      <h2 class="mb-4 text-3xl font-bold md:text-4xl">Trusted by Those Who Need It Most</h2>
      <p class="text-muted-foreground mx-auto max-w-2xl text-xl">
        When your information is critical, you need a solution you can trust
      </p>
    </div>

    <div class="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
      <Card.Root class="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
        <Card.Header>
          <Key
            class="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110"
          />
          <Card.Title>Cryptocurrency Holders</Card.Title>
          <Card.Description>Secure your private keys and recovery phrases</Card.Description>
        </Card.Header>
        <Card.Content>
          <p class="text-muted-foreground mb-4 text-sm">
            Ensure your family can access your crypto assets if something happens to you. Your
            private keys stay encrypted and are only released to trusted recipients when needed.
          </p>
          <div class="space-y-2">
            <div class="text-muted-foreground flex items-center text-xs">
              <CheckCircle class="text-accent-foreground mr-2 h-3 w-3" />
              Hardware wallet recovery phrases
            </div>
            <div class="text-muted-foreground flex items-center text-xs">
              <CheckCircle class="text-accent-foreground mr-2 h-3 w-3" />
              Exchange account details
            </div>
            <div class="text-muted-foreground flex items-center text-xs">
              <CheckCircle class="text-accent-foreground mr-2 h-3 w-3" />
              Cold storage instructions
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <Card.Root class="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
        <Card.Header>
          <FileText
            class="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110"
          />
          <Card.Title>Journalists & Activists</Card.Title>
          <Card.Description>Protect sensitive sources and information</Card.Description>
        </Card.Header>
        <Card.Content>
          <p class="text-muted-foreground mb-4 text-sm">
            Safeguard critical information and source protection. If you're compromised, ensure
            trusted colleagues can continue your work and protect those who helped you.
          </p>
          <div class="space-y-2">
            <div class="text-muted-foreground flex items-center text-xs">
              <CheckCircle class="text-accent-foreground mr-2 h-3 w-3" />
              Source contact information
            </div>
            <div class="text-muted-foreground flex items-center text-xs">
              <CheckCircle class="text-accent-foreground mr-2 h-3 w-3" />
              Encrypted document locations
            </div>
            <div class="text-muted-foreground flex items-center text-xs">
              <CheckCircle class="text-accent-foreground mr-2 h-3 w-3" />
              Investigation handoff protocols
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <Card.Root class="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
        <Card.Header>
          <Users
            class="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110"
          />
          <Card.Title>Estate Planning</Card.Title>
          <Card.Description>Digital inheritance made simple</Card.Description>
        </Card.Header>
        <Card.Content>
          <p class="text-muted-foreground mb-4 text-sm">
            Ensure your digital assets and important accounts can be accessed by your loved ones,
            even during difficult or overwhelming times when immediate access is crucial.
          </p>
          <div class="space-y-2">
            <div class="text-muted-foreground flex items-center text-xs">
              <CheckCircle class="text-accent-foreground mr-2 h-3 w-3" />
              Financial account access
            </div>
            <div class="text-muted-foreground flex items-center text-xs">
              <CheckCircle class="text-accent-foreground mr-2 h-3 w-3" />
              Digital asset inventories
            </div>
            <div class="text-muted-foreground flex items-center text-xs">
              <CheckCircle class="text-accent-foreground mr-2 h-3 w-3" />
              Important document locations
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  </section>

  <!-- How It Works Section -->
  <section id="how-it-works" class="container mx-auto px-4 py-24">
    <div class="mb-16 text-center">
      <h2 class="mb-4 text-3xl font-bold md:text-4xl">How KeyFate Protects Your Secrets</h2>
      <p class="text-muted-foreground mx-auto max-w-3xl text-xl">
        Advanced cryptography meets simple usability. Your secrets are mathematically impossible for
        us to read.
      </p>
    </div>

    <div class="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3">
      <div class="group text-center">
        <div class="mb-6">
          <div
            class="bg-primary/10 group-hover:bg-primary/20 mx-auto flex h-20 w-20 items-center justify-center rounded-full transition-colors duration-300"
          >
            <Lock class="text-primary h-10 w-10" />
          </div>
        </div>
        <h3 class="mb-3 text-xl font-semibold">Create & Encrypt</h3>
        <p class="text-muted-foreground">
          Your secret is split into 3 encrypted pieces using <strong
            >Shamir's Secret Sharing</strong
          > - entirely in your browser. The original never leaves your device.
        </p>
      </div>

      <div class="group text-center">
        <div class="mb-6">
          <div
            class="bg-primary/10 group-hover:bg-primary/20 mx-auto flex h-20 w-20 items-center justify-center rounded-full transition-colors duration-300"
          >
            <Shield class="text-primary h-10 w-10" />
          </div>
        </div>
        <h3 class="mb-3 text-xl font-semibold">Secure Storage</h3>
        <p class="text-muted-foreground">
          We store just <strong>1 encrypted piece</strong> (useless alone). You keep 1 piece. Your
          recipient gets 1 piece. <strong>2 pieces minimum</strong> needed to unlock.
        </p>
      </div>

      <div class="group text-center">
        <div class="mb-6">
          <div
            class="bg-primary/10 group-hover:bg-primary/20 mx-auto flex h-20 w-20 items-center justify-center rounded-full transition-colors duration-300"
          >
            <Clock class="text-primary h-10 w-10" />
          </div>
        </div>
        <h3 class="mb-3 text-xl font-semibold">Automatic Release</h3>
        <p class="text-muted-foreground">
          If you don't check in on schedule, we send our encrypted piece to your recipient. They
          combine it with theirs to <strong>reconstruct your secret</strong>.
        </p>
      </div>
    </div>

    <div class="mt-16 text-center">
      <Card.Root class="bg-muted/50 border-primary/20 mx-auto max-w-2xl">
        <Card.Content class="pt-6">
          <div class="mb-4 flex items-center justify-center">
            <EyeOff class="text-primary mr-2 h-6 w-6" />
            <span class="font-semibold">Zero-Knowledge Promise</span>
          </div>
          <p class="text-muted-foreground text-sm">
            <strong>We mathematically cannot read your secrets.</strong> Even if our servers were
            compromised, your information remains secure. Only you and your chosen recipients can
            reconstruct the original data.
          </p>
        </Card.Content>
      </Card.Root>
    </div>
  </section>

  <!-- Features Section -->
  <section class="bg-muted/30 container mx-auto px-4 py-24">
    <div class="mb-16 text-center">
      <h2 class="mb-4 text-3xl font-bold md:text-4xl">Built for Security & Peace of Mind</h2>
      <p class="text-muted-foreground text-xl">
        Enterprise-grade security with consumer-friendly simplicity
      </p>
    </div>

    <div class="mx-auto grid max-w-6xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {#each [
        { icon: Shield, title: 'Military-Grade Encryption', desc: 'AES-256 encryption with client-side Shamir\'s Secret Sharing', body: 'Your secrets are encrypted with the same standards used by governments and militaries. The cryptographic splitting happens entirely in your browser.' },
        { icon: Clock, title: 'Flexible Check-ins', desc: 'Set your own schedule from daily to yearly', body: 'Choose check-in intervals that work for your lifestyle. Get gentle reminders before deadlines. One-click check-ins from anywhere.' },
        { icon: Users, title: 'Trusted Recipients', desc: 'Verify recipients and customize delivery messages', body: 'Email verification ensures your secrets reach the right people. Add custom instructions to help recipients understand what they\'re receiving.' },
        { icon: Zap, title: 'Instant Setup', desc: 'Start protecting your secrets in under 5 minutes', body: 'Quick and simple signup process. No complex configuration. Our intuitive interface guides you through creating your first secret.' },
        { icon: Globe, title: 'Global Reliability', desc: 'Robust infrastructure with worldwide availability', body: 'Built on modern cloud infrastructure. Your check-ins and notifications work reliably from anywhere in the world.' },
        { icon: Eye, title: 'Full Transparency', desc: 'Open-source cryptography with audit trail', body: 'Our encryption methods are based on proven, open-source algorithms. Full audit logs show exactly when and how your secrets are accessed.' },
      ] as feature}
        <Card.Root class="group transition-all duration-300 hover:shadow-lg">
          <Card.Header>
            <feature.icon
              class="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110"
            />
            <Card.Title>{feature.title}</Card.Title>
            <Card.Description>{feature.desc}</Card.Description>
          </Card.Header>
          <Card.Content>
            <p class="text-muted-foreground text-sm">{feature.body}</p>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  </section>

  <!-- CTA Section -->
  <section class="bg-primary/5 border-t">
    <div class="container mx-auto px-4 py-24">
      <div class="mx-auto max-w-4xl text-center">
        <h2 class="mb-6 text-4xl font-bold tracking-tight md:text-5xl">
          Ready to Protect Your Digital Legacy?
        </h2>
        <p class="text-muted-foreground mb-8 text-xl leading-relaxed md:text-2xl">
          Join thousands who trust KeyFate to safeguard their most important information. Start with
          our free plan and upgrade as you grow.
        </p>

        <div class="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" class="px-8 py-6 text-lg" href="/auth/signin">
            Get Started Free
            <ArrowRight class="ml-2 h-5 w-5" />
          </Button>
          <Button variant="outline" size="lg" class="px-8 py-6 text-lg" href="/pricing">
            View Pricing
          </Button>
        </div>

        <div
          class="text-muted-foreground flex flex-wrap items-center justify-center gap-8 text-sm"
        >
          <div class="flex items-center gap-2">
            <CheckCircle class="text-accent-foreground h-4 w-4" />
            <span>Free to start</span>
          </div>
          <div class="flex items-center gap-2">
            <CheckCircle class="text-accent-foreground h-4 w-4" />
            <span>No credit card required</span>
          </div>
          <div class="flex items-center gap-2">
            <CheckCircle class="text-accent-foreground h-4 w-4" />
            <span>30-day money-back guarantee</span>
          </div>
        </div>

        <div class="mt-8">
          <a
            href="/blog"
            class="text-muted-foreground hover:text-primary text-sm underline-offset-4 hover:underline"
          >
            Learn more on our blog &rarr;
          </a>
        </div>
      </div>
    </div>
  </section>

  <Footer />
</div>
