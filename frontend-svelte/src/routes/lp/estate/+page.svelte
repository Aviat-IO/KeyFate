<script lang="ts">
  import NavBar from '$lib/components/NavBar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import {
    Shield, Lock, Clock, CheckCircle, EyeOff, ArrowRight, AlertTriangle,
    Camera, CreditCard, Mail, Music, Cloud, FileText, Heart, Home, Smartphone, Key
  } from 'lucide-svelte';

  let scrollY = $state(0);

  const digitalAssets = [
    { icon: CreditCard, label: 'Bank & financial accounts', detail: 'Online banking, investment accounts, retirement funds' },
    { icon: Camera, label: 'Photos & videos', detail: 'Google Photos, iCloud, family memories spanning decades' },
    { icon: Mail, label: 'Email accounts', detail: 'Gmail, Outlook — the keys to resetting everything else' },
    { icon: Music, label: 'Digital purchases', detail: 'iTunes, Kindle, Steam — thousands in digital content' },
    { icon: Cloud, label: 'Cloud storage', detail: 'Dropbox, Google Drive, OneDrive — important documents' },
    { icon: Smartphone, label: 'Social media accounts', detail: 'Facebook, Instagram — years of memories and connections' },
    { icon: Heart, label: 'Health records', detail: 'Patient portals, medical history, insurance details' },
    { icon: Home, label: 'Smart home & subscriptions', detail: 'Utilities, insurance, streaming — all need passwords' }
  ];
</script>

<svelte:window bind:scrollY />

<svelte:head>
  <title>Digital Estate Planning — Your Family Can't Access Your Passwords | KeyFate</title>
  <meta name="description" content="Traditional wills don't cover digital assets. KeyFate automatically delivers your passwords, accounts, and important documents to your family when they need them most." />
</svelte:head>

<div class="bg-background min-h-screen">
  <nav class="fixed left-0 right-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
    <NavBar />
  </nav>

  <div class="h-16"></div>

  <!-- Hero -->
  <section class="container relative mx-auto overflow-hidden px-4 py-32">
    <div class="relative z-10 mx-auto max-w-5xl text-center">
      <Badge variant="outline" class="mb-6 text-sm">
        <FileText class="mr-2 h-3 w-3" />
        Digital Estate Planning
      </Badge>

      <h1 class="mb-8 text-5xl font-bold tracking-tight md:text-7xl">
        Your Family Can't Access Your
        <span class="text-primary">Digital Life</span>
        Without Your Passwords
      </h1>

      <p class="text-muted-foreground my-12 text-xl leading-relaxed md:text-2xl">
        Traditional wills don't cover digital assets.<br />
        <span class="text-foreground font-medium">Passwords, accounts, photos, documents — all inaccessible without you.</span>
      </p>

      <div class="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Button size="lg" class="px-8 py-6 text-lg" href="/auth/signin">
          Set Up Your Digital Legacy — Free
          <ArrowRight class="ml-2 h-5 w-5" />
        </Button>
        <Button variant="outline" size="lg" class="px-8 py-6 text-lg" href="#how-it-works">
          See How It Works
        </Button>
      </div>

      <div class="text-muted-foreground flex flex-wrap items-center justify-center gap-8 text-sm">
        {#each ['Free plan available', 'No lawyers needed', 'Military-grade encryption'] as item}
          <div class="flex items-center gap-2">
            <CheckCircle class="text-accent-foreground h-4 w-4" />
            <span>{item}</span>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- What's at Stake -->
  <section class="bg-muted/30 container mx-auto px-4 py-24">
    <div class="mb-16 text-center">
      <h2 class="mb-4 text-3xl font-bold md:text-4xl">What's at Stake?</h2>
      <p class="text-muted-foreground mx-auto max-w-2xl text-xl">
        The average person has 100+ online accounts. Here's what your family can't access without your passwords.
      </p>
    </div>

    <div class="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {#each digitalAssets as asset}
        <Card.Root class="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <Card.Header class="pb-2">
            <asset.icon class="text-primary mb-2 h-8 w-8 transition-transform duration-300 group-hover:scale-110" />
            <Card.Title class="text-base">{asset.label}</Card.Title>
          </Card.Header>
          <Card.Content>
            <p class="text-muted-foreground text-xs">{asset.detail}</p>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>

    <div class="mt-12 text-center">
      <Card.Root class="border-destructive/20 bg-destructive/5 mx-auto max-w-2xl">
        <Card.Content class="pt-6">
          <div class="mb-4 flex items-center justify-center">
            <AlertTriangle class="text-destructive mr-2 h-6 w-6" />
            <span class="font-semibold">The Hard Truth</span>
          </div>
          <p class="text-muted-foreground text-sm">
            When someone dies, tech companies make account recovery incredibly difficult — or impossible. Apple, Google, and Facebook all require lengthy legal processes that can take months and still fail.
          </p>
        </Card.Content>
      </Card.Root>
    </div>
  </section>

  <!-- Why Not a Will -->
  <section class="container mx-auto px-4 py-24">
    <div class="mb-16 text-center">
      <h2 class="mb-4 text-3xl font-bold md:text-4xl">Why a Traditional Will Isn't Enough</h2>
      <p class="text-muted-foreground mx-auto max-w-2xl text-xl">Wills were designed for physical assets. Digital lives need a different approach.</p>
    </div>

    <div class="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
      {#each [
        { icon: AlertTriangle, title: 'Passwords Change', desc: "A will is static — your digital life isn't", content: "You update passwords regularly. A will written last year already has outdated credentials. KeyFate lets you update secrets anytime — they're always current." },
        { icon: Clock, title: 'Probate Takes Months', desc: 'Your family needs access now, not in 6 months', content: 'Wills go through probate — a legal process that takes months or years. Meanwhile, subscriptions charge, bills pile up, and accounts get locked. KeyFate delivers automatically.' },
        { icon: EyeOff, title: 'Wills Are Public Record', desc: 'Your passwords would be visible to anyone', content: 'Wills become public documents after probate. Putting passwords in a will means anyone can see them. KeyFate uses zero-knowledge encryption — only your chosen recipient can decrypt.' }
      ] as card}
        <Card.Root class="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <Card.Header>
            <card.icon class="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
            <Card.Title>{card.title}</Card.Title>
            <Card.Description>{card.desc}</Card.Description>
          </Card.Header>
          <Card.Content>
            <p class="text-muted-foreground text-sm">{card.content}</p>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  </section>

  <!-- How It Works -->
  <section id="how-it-works" class="bg-muted/30 container mx-auto px-4 py-24">
    <div class="mb-16 text-center">
      <h2 class="mb-4 text-3xl font-bold md:text-4xl">How KeyFate Works</h2>
      <p class="text-muted-foreground mx-auto max-w-3xl text-xl">Simple setup. Automated delivery. No lawyers required.</p>
    </div>

    <div class="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3">
      {#each [
        { icon: Lock, step: 'Step 1', title: 'Create & Encrypt', desc: "Enter your passwords, account details, or instructions. Everything is encrypted in your browser using Shamir's Secret Sharing before it ever leaves your device." },
        { icon: Shield, step: 'Step 2', title: 'Store Securely', desc: 'Your secret is split into 3 encrypted pieces. We store 1 piece (useless alone). You keep 1. Your recipient gets 1. Nobody can read it individually.' },
        { icon: Clock, step: 'Step 3', title: 'Automatic Release', desc: 'Check in on your schedule (weekly, monthly, yearly). If you stop checking in, we automatically deliver our piece to your recipient so they can reconstruct your secrets.' }
      ] as item}
        <div class="group text-center">
          <div class="mb-6">
            <div class="bg-primary/10 group-hover:bg-primary/20 mx-auto flex h-20 w-20 items-center justify-center rounded-full transition-colors duration-300">
              <item.icon class="text-primary h-10 w-10" />
            </div>
            <div class="text-muted-foreground mt-2 text-sm font-semibold">{item.step}</div>
          </div>
          <h3 class="mb-3 text-xl font-semibold">{item.title}</h3>
          <p class="text-muted-foreground">{item.desc}</p>
        </div>
      {/each}
    </div>

    <div class="mt-16 text-center">
      <Card.Root class="bg-muted/50 border-primary/20 mx-auto max-w-2xl">
        <Card.Content class="pt-6">
          <div class="mb-4 flex items-center justify-center">
            <EyeOff class="text-primary mr-2 h-6 w-6" />
            <span class="font-semibold">Zero-Knowledge Promise</span>
          </div>
          <p class="text-muted-foreground text-sm">
            <strong>We mathematically cannot read your secrets.</strong> All encryption happens in your browser. Even if our servers were compromised, your information remains secure.
          </p>
        </Card.Content>
      </Card.Root>
    </div>
  </section>

  <!-- Security -->
  <section class="container mx-auto px-4 py-24">
    <div class="mb-16 text-center">
      <h2 class="mb-4 text-3xl font-bold md:text-4xl">Security You Can Verify</h2>
      <p class="text-muted-foreground mx-auto max-w-2xl text-xl">Built on proven, open-source cryptographic standards.</p>
    </div>

    <div class="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
      {#each [
        { icon: Shield, title: 'AES-256 Encryption', desc: 'The gold standard of encryption, used by governments and financial institutions worldwide.' },
        { icon: Key, title: "Shamir's Secret Sharing", desc: 'A proven cryptographic technique that splits secrets into pieces. No single piece reveals anything.' },
        { icon: EyeOff, title: 'Client-Side Only', desc: 'All encryption and decryption happens in your browser. Your plaintext secrets never leave your device.' },
        { icon: Lock, title: 'Open-Source Algorithms', desc: 'Our cryptographic methods are based on peer-reviewed, open-source algorithms that anyone can audit.' }
      ] as item}
        <Card.Root class="group transition-all duration-300 hover:shadow-lg">
          <Card.Header>
            <Card.Title class="flex items-center gap-3 text-lg">
              <item.icon class="text-primary h-6 w-6" />
              {item.title}
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <p class="text-muted-foreground text-sm">{item.desc}</p>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  </section>

  <!-- CTA -->
  <section class="bg-primary/5 border-t">
    <div class="container mx-auto px-4 py-24">
      <div class="mx-auto max-w-4xl text-center">
        <h2 class="mb-6 text-4xl font-bold tracking-tight md:text-5xl">Your Digital Legacy Deserves a Plan</h2>
        <p class="text-muted-foreground mb-8 text-xl leading-relaxed md:text-2xl">
          Set up in under 5 minutes. Free plan includes 1 secret and 1 recipient.
        </p>

        <div class="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" class="px-8 py-6 text-lg" href="/auth/signin">
            Set Up Your Digital Legacy — Free
            <ArrowRight class="ml-2 h-5 w-5" />
          </Button>
          <Button variant="outline" size="lg" class="px-8 py-6 text-lg" href="/pricing">
            View Pricing
          </Button>
        </div>

        <div class="text-muted-foreground flex flex-wrap items-center justify-center gap-8 text-sm">
          {#each ['Free to start', 'No credit card required', 'No lawyers needed'] as item}
            <div class="flex items-center gap-2">
              <CheckCircle class="text-accent-foreground h-4 w-4" />
              <span>{item}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <Footer />
</div>
