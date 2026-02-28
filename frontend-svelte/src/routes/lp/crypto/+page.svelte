<script lang="ts">
  import NavBar from '$lib/components/NavBar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import {
    Shield, Lock, Clock, Key, CheckCircle, EyeOff, ArrowRight,
    AlertTriangle, XCircle, Coins, Wallet
  } from 'lucide-svelte';

  let scrollY = $state(0);
</script>

<svelte:window bind:scrollY />

<svelte:head>
  <title>What Happens to Your Bitcoin When You Die? — KeyFate</title>
  <meta name="description" content="Protect your cryptocurrency keys with KeyFate's dead man's switch. Zero-knowledge encryption ensures your family can access your crypto if something happens to you." />
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
        <Coins class="mr-2 h-3 w-3" />
        Crypto Key Protection
      </Badge>

      <h1 class="mb-8 text-5xl font-bold tracking-tight md:text-7xl">
        What Happens to Your
        <span class="text-primary">Bitcoin</span>
        When You Die?
      </h1>

      <p class="text-muted-foreground my-12 text-xl leading-relaxed md:text-2xl">
        Your family can't call a bank to recover your crypto.<br />
        <span class="text-foreground font-medium">Lost keys = lost crypto. Forever.</span>
      </p>

      <div class="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Button size="lg" class="px-8 py-6 text-lg" href="/auth/signin">
          Protect Your First Secret — Free
          <ArrowRight class="ml-2 h-5 w-5" />
        </Button>
        <Button variant="outline" size="lg" class="px-8 py-6 text-lg" href="#how-it-works">
          See How It Works
        </Button>
      </div>

      <div class="text-muted-foreground flex flex-wrap items-center justify-center gap-8 text-sm">
        {#each ['No credit card required', 'Zero-knowledge encryption', "Shamir's Secret Sharing"] as item}
          <div class="flex items-center gap-2">
            <CheckCircle class="text-accent-foreground h-4 w-4" />
            <span>{item}</span>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- The Problem -->
  <section class="bg-muted/30 container mx-auto px-4 py-24">
    <div class="mb-16 text-center">
      <h2 class="mb-4 text-3xl font-bold md:text-4xl">The $140 Billion Problem</h2>
      <p class="text-muted-foreground mx-auto max-w-2xl text-xl">
        An estimated 20% of all Bitcoin is permanently lost because nobody had the keys
      </p>
    </div>

    <div class="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
      {#each [
        { icon: AlertTriangle, title: 'Keys Lost = Crypto Lost', desc: "There's no \"forgot password\" for Bitcoin", content: "Unlike a bank account, no one can reset your crypto wallet. If your private keys die with you, your family's inheritance is gone — permanently and irreversibly." },
        { icon: XCircle, title: 'Paper Backups Fail', desc: 'Fire, theft, and confusion destroy paper', content: 'Seed phrases on paper can burn, get stolen, or simply confuse non-technical family members. Even a safe deposit box requires someone to know it exists.' },
        { icon: EyeOff, title: 'Trusting Others Is Risky', desc: 'Sharing keys means giving up control', content: 'Giving your private keys to a lawyer, friend, or family member means they could access your crypto at any time. You need a solution that releases access only when needed.' }
      ] as card}
        <Card.Root class="group border-destructive/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <Card.Header>
            <card.icon class="text-destructive mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
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
  <section id="how-it-works" class="container mx-auto px-4 py-24">
    <div class="mb-16 text-center">
      <h2 class="mb-4 text-3xl font-bold md:text-4xl">How KeyFate Protects Your Crypto Keys</h2>
      <p class="text-muted-foreground mx-auto max-w-3xl text-xl">Three simple steps. Military-grade cryptography. Zero trust required.</p>
    </div>

    <div class="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3">
      {#each [
        { icon: Lock, step: 'Step 1', title: 'Create & Encrypt', desc: "Enter your seed phrase or private key. It's split into 3 encrypted pieces using Shamir's Secret Sharing — entirely in your browser." },
        { icon: Shield, step: 'Step 2', title: 'Store Securely', desc: 'We store just 1 encrypted piece (useless alone). You keep 1 piece. Your recipient gets 1 piece. Nobody has enough to reconstruct your key.' },
        { icon: Clock, step: 'Step 3', title: 'Automatic Release', desc: 'Check in on your schedule. If you miss check-ins, we send our piece to your recipient. They combine 2 pieces to reconstruct your key.' }
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
            <span class="font-semibold">Even KeyFate Can't Read Your Keys</span>
          </div>
          <p class="text-muted-foreground text-sm">
            <strong>Zero-knowledge architecture</strong> means we mathematically cannot access your private keys. Even if our servers were compromised, your crypto remains secure.
          </p>
        </Card.Content>
      </Card.Root>
    </div>
  </section>

  <!-- Comparison Table -->
  <section class="bg-muted/30 container mx-auto px-4 py-24">
    <div class="mb-16 text-center">
      <h2 class="mb-4 text-3xl font-bold md:text-4xl">How Does KeyFate Compare?</h2>
      <p class="text-muted-foreground mx-auto max-w-2xl text-xl">Every option has trade-offs. Here's how they stack up.</p>
    </div>

    <div class="mx-auto max-w-5xl overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b">
            <th class="px-4 py-4 font-semibold">Feature</th>
            <th class="bg-primary/5 border-primary/20 border-x px-4 py-4 font-semibold">
              <div class="flex items-center gap-2"><Shield class="text-primary h-4 w-4" /> KeyFate</div>
            </th>
            <th class="px-4 py-4 font-semibold">Paper Backup</th>
            <th class="px-4 py-4 font-semibold">Hardware Wallet Only</th>
            <th class="px-4 py-4 font-semibold">Lawyer</th>
          </tr>
        </thead>
        <tbody class="text-muted-foreground">
          {#each [
            { feature: 'Automatic release on death', keyfate: true, paper: false, hw: false, lawyer: 'Slow (probate)' },
            { feature: 'Zero-knowledge security', keyfate: true, paper: false, hw: true, lawyer: false },
            { feature: 'No single point of failure', keyfate: true, paper: false, hw: false, lawyer: false },
            { feature: 'Fire/theft resistant', keyfate: true, paper: false, hw: false, lawyer: true },
            { feature: 'No trust required', keyfate: true, paper: true, hw: true, lawyer: false },
            { feature: 'Non-technical recipients', keyfate: true, paper: false, hw: false, lawyer: false }
          ] as row}
            <tr class="border-b">
              <td class="px-4 py-3 font-medium">{row.feature}</td>
              <td class="bg-primary/5 border-primary/20 border-x px-4 py-3">
                {#if row.keyfate === true}<CheckCircle class="h-4 w-4 text-green-500" />{:else}<XCircle class="h-4 w-4 text-red-500" />{/if}
              </td>
              <td class="px-4 py-3">
                {#if row.paper === true}<CheckCircle class="h-4 w-4 text-green-500" />{:else}<XCircle class="h-4 w-4 text-red-500" />{/if}
              </td>
              <td class="px-4 py-3">
                {#if row.hw === true}<CheckCircle class="h-4 w-4 text-green-500" />{:else}<XCircle class="h-4 w-4 text-red-500" />{/if}
              </td>
              <td class="px-4 py-3">
                {#if typeof row.lawyer === 'string'}<span class="text-yellow-500">{row.lawyer}</span>{:else if row.lawyer}<CheckCircle class="h-4 w-4 text-green-500" />{:else}<XCircle class="h-4 w-4 text-red-500" />{/if}
              </td>
            </tr>
          {/each}
          <tr>
            <td class="px-4 py-3 font-medium">Cost</td>
            <td class="bg-primary/5 border-primary/20 border-x px-4 py-3 font-medium text-green-500">Free plan available</td>
            <td class="px-4 py-3">Free (risky)</td>
            <td class="px-4 py-3">$50-200 device</td>
            <td class="px-4 py-3">$200+/hr</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- Trust Indicators -->
  <section class="container mx-auto px-4 py-24">
    <div class="mb-16 text-center">
      <h2 class="mb-4 text-3xl font-bold md:text-4xl">Built on Proven Cryptographic Standards</h2>
      <p class="text-muted-foreground mx-auto max-w-2xl text-xl">No proprietary magic. Just battle-tested, open-source cryptography.</p>
    </div>

    <div class="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
      {#each [
        { icon: Shield, title: 'AES-256 Encryption', desc: 'The same encryption standard used by the US government for classified information.' },
        { icon: Key, title: "Shamir's Secret Sharing", desc: "Invented by cryptographer Adi Shamir (the 'S' in RSA). Splits your key into pieces where no single piece reveals anything." },
        { icon: EyeOff, title: 'Zero-Knowledge Architecture', desc: 'All encryption happens client-side in your browser. We never see, store, or transmit your unencrypted keys.' },
        { icon: Lock, title: 'Open-Source Cryptography', desc: 'Our encryption is built on open-source, peer-reviewed algorithms. No security through obscurity.' }
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
        <h2 class="mb-6 text-4xl font-bold tracking-tight md:text-5xl">Don't Let Your Crypto Die With You</h2>
        <p class="text-muted-foreground mb-8 text-xl leading-relaxed md:text-2xl">
          Set up your first secret in under 5 minutes. Free plan includes 1 secret and 1 recipient.
        </p>

        <div class="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" class="px-8 py-6 text-lg" href="/auth/signin">
            Protect Your First Secret — Free
            <ArrowRight class="ml-2 h-5 w-5" />
          </Button>
          <Button variant="outline" size="lg" class="px-8 py-6 text-lg" href="/pricing">
            View Pricing
          </Button>
        </div>

        <div class="text-muted-foreground flex flex-wrap items-center justify-center gap-8 text-sm">
          {#each ['Free to start', 'No credit card required', 'Setup in under 5 minutes'] as item}
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
