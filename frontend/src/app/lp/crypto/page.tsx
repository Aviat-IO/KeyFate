"use client"

import { Footer } from "@/components/footer"
import { NavBar } from "@/components/nav-bar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Shield,
  Lock,
  Clock,
  Key,
  CheckCircle,
  EyeOff,
  ArrowRight,
  AlertTriangle,
  XCircle,
  Coins,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import Head from "next/head"

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Crypto Key Protection — KeyFate Dead Man's Switch",
  description:
    "Protect your cryptocurrency keys with a dead man's switch. If something happens to you, your family can still access your Bitcoin, Ethereum, and other crypto assets.",
  url: "https://keyfate.com/lp/crypto",
  publisher: {
    "@type": "Organization",
    name: "KeyFate",
    url: "https://keyfate.com",
  },
}

export default function CryptoLandingPage() {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="bg-background min-h-screen">
      <head>
        <title>What Happens to Your Bitcoin When You Die? — KeyFate</title>
        <meta
          name="description"
          content="Protect your cryptocurrency keys with KeyFate's dead man's switch. Zero-knowledge encryption ensures your family can access your crypto if something happens to you."
        />
        <meta
          property="og:title"
          content="What Happens to Your Bitcoin When You Die? — KeyFate"
        />
        <meta
          property="og:description"
          content="Your family can't access your crypto without your keys. KeyFate uses Shamir's Secret Sharing to protect and automatically release your keys when needed."
        />
        <meta property="og:url" content="https://keyfate.com/lp/crypto" />
        <meta property="og:type" content="website" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>

      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <NavBar />
      </nav>

      <div className="h-16" />

      {/* Hero Section */}
      <section className="container relative mx-auto overflow-hidden px-4 py-32">
        <div
          className="absolute inset-0 opacity-5"
          style={{ transform: `translateY(${scrollY * 0.3}px)` }}
        >
          <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-yellow-500/30 blur-2xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <Badge
            variant="outline"
            className="animate-in fade-in slide-in-from-bottom-4 mb-6 text-sm duration-700"
          >
            <Coins className="mr-2 h-3 w-3" />
            Crypto Key Protection
          </Badge>

          <h1 className="animate-in fade-in slide-in-from-bottom-6 mb-8 text-5xl font-bold tracking-tight delay-200 duration-700 md:text-7xl">
            What Happens to Your{" "}
            <span className="text-primary relative">
              Bitcoin
              <div className="bg-primary/30 animate-in slide-in-from-left absolute -bottom-2 left-0 right-0 h-1 rounded-full delay-1000 duration-1000" />
            </span>{" "}
            When You Die?
          </h1>

          <p className="text-muted-foreground animate-in fade-in slide-in-from-bottom-8 delay-400 my-12 text-xl leading-relaxed duration-700 md:text-2xl">
            Your family can't call a bank to recover your crypto.
            <br />
            <span className="text-foreground font-medium">
              Lost keys = lost crypto. Forever.
            </span>
          </p>

          <div className="animate-in fade-in slide-in-from-bottom-10 delay-600 mb-16 flex flex-col items-center justify-center gap-4 duration-700 sm:flex-row">
            <Button size="lg" className="px-8 py-6 text-lg" asChild>
              <Link href="/auth/signin">
                Protect Your First Secret — Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="px-8 py-6 text-lg"
              asChild
            >
              <Link href="#how-it-works">See How It Works</Link>
            </Button>
          </div>

          <div className="text-muted-foreground animate-in fade-in slide-in-from-bottom-12 delay-800 flex flex-wrap items-center justify-center gap-8 text-sm duration-700">
            <div className="flex items-center gap-2">
              <CheckCircle className="text-accent-foreground h-4 w-4" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="text-accent-foreground h-4 w-4" />
              <span>Zero-knowledge encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="text-accent-foreground h-4 w-4" />
              <span>Shamir's Secret Sharing</span>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="bg-muted/30 container mx-auto px-4 py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            The $140 Billion Problem
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            An estimated 20% of all Bitcoin is permanently lost because nobody
            had the keys
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
          <Card className="group border-destructive/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <CardHeader>
              <AlertTriangle className="text-destructive mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
              <CardTitle>Keys Lost = Crypto Lost</CardTitle>
              <CardDescription>
                There's no "forgot password" for Bitcoin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Unlike a bank account, no one can reset your crypto wallet. If
                your private keys die with you, your family's inheritance is
                gone — permanently and irreversibly.
              </p>
            </CardContent>
          </Card>

          <Card className="group border-destructive/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <CardHeader>
              <XCircle className="text-destructive mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
              <CardTitle>Paper Backups Fail</CardTitle>
              <CardDescription>
                Fire, theft, and confusion destroy paper
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Seed phrases on paper can burn, get stolen, or simply confuse
                non-technical family members. Even a safe deposit box requires
                someone to know it exists and how to use what's inside.
              </p>
            </CardContent>
          </Card>

          <Card className="group border-destructive/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <CardHeader>
              <EyeOff className="text-destructive mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
              <CardTitle>Trusting Others Is Risky</CardTitle>
              <CardDescription>
                Sharing keys means giving up control
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Giving your private keys to a lawyer, friend, or family member
                means they could access your crypto at any time. You need a
                solution that releases access only when it's needed.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="container mx-auto px-4 py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            How KeyFate Protects Your Crypto Keys
          </h2>
          <p className="text-muted-foreground mx-auto max-w-3xl text-xl">
            Three simple steps. Military-grade cryptography. Zero trust
            required.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3">
          <div className="group text-center">
            <div className="mb-6">
              <div className="bg-primary/10 group-hover:bg-primary/20 mx-auto flex h-20 w-20 items-center justify-center rounded-full transition-colors duration-300">
                <Lock className="text-primary h-10 w-10" />
              </div>
              <div className="text-muted-foreground mt-2 text-sm font-semibold">
                Step 1
              </div>
            </div>
            <h3 className="mb-3 text-xl font-semibold">Create & Encrypt</h3>
            <p className="text-muted-foreground">
              Enter your seed phrase or private key. It's split into 3 encrypted
              pieces using <strong>Shamir's Secret Sharing</strong> — entirely
              in your browser. The original never touches our servers.
            </p>
          </div>

          <div className="group text-center">
            <div className="mb-6">
              <div className="bg-primary/10 group-hover:bg-primary/20 mx-auto flex h-20 w-20 items-center justify-center rounded-full transition-colors duration-300">
                <Shield className="text-primary h-10 w-10" />
              </div>
              <div className="text-muted-foreground mt-2 text-sm font-semibold">
                Step 2
              </div>
            </div>
            <h3 className="mb-3 text-xl font-semibold">Store Securely</h3>
            <p className="text-muted-foreground">
              We store just <strong>1 encrypted piece</strong> (useless alone).
              You keep 1 piece. Your recipient gets 1 piece. Nobody has enough
              to reconstruct your key.
            </p>
          </div>

          <div className="group text-center">
            <div className="mb-6">
              <div className="bg-primary/10 group-hover:bg-primary/20 mx-auto flex h-20 w-20 items-center justify-center rounded-full transition-colors duration-300">
                <Clock className="text-primary h-10 w-10" />
              </div>
              <div className="text-muted-foreground mt-2 text-sm font-semibold">
                Step 3
              </div>
            </div>
            <h3 className="mb-3 text-xl font-semibold">Automatic Release</h3>
            <p className="text-muted-foreground">
              Check in on your schedule. If you miss check-ins, we send our
              piece to your recipient. They combine 2 pieces to{" "}
              <strong>reconstruct your key</strong> and access your crypto.
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Card className="bg-muted/50 border-primary/20 mx-auto max-w-2xl">
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-center">
                <EyeOff className="text-primary mr-2 h-6 w-6" />
                <span className="font-semibold">
                  Even KeyFate Can't Read Your Keys
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                <strong>Zero-knowledge architecture</strong> means we
                mathematically cannot access your private keys. Even if our
                servers were compromised, your crypto remains secure. We only
                store one useless fragment.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="bg-muted/30 container mx-auto px-4 py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            How Does KeyFate Compare?
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            Every option has trade-offs. Here's how they stack up.
          </p>
        </div>

        <div className="mx-auto max-w-5xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-4 font-semibold">Feature</th>
                <th className="bg-primary/5 border-primary/20 border-x px-4 py-4 font-semibold">
                  <div className="flex items-center gap-2">
                    <Shield className="text-primary h-4 w-4" />
                    KeyFate
                  </div>
                </th>
                <th className="px-4 py-4 font-semibold">Paper Backup</th>
                <th className="px-4 py-4 font-semibold">Hardware Wallet Only</th>
                <th className="px-4 py-4 font-semibold">Lawyer</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b">
                <td className="px-4 py-3 font-medium">Automatic release on death</td>
                <td className="bg-primary/5 border-primary/20 border-x px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </td>
                <td className="px-4 py-3">
                  <XCircle className="h-4 w-4 text-red-500" />
                </td>
                <td className="px-4 py-3">
                  <XCircle className="h-4 w-4 text-red-500" />
                </td>
                <td className="px-4 py-3">
                  <span className="text-yellow-500">Slow (probate)</span>
                </td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-3 font-medium">Zero-knowledge security</td>
                <td className="bg-primary/5 border-primary/20 border-x px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </td>
                <td className="px-4 py-3">
                  <XCircle className="h-4 w-4 text-red-500" />
                </td>
                <td className="px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </td>
                <td className="px-4 py-3">
                  <XCircle className="h-4 w-4 text-red-500" />
                </td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-3 font-medium">No single point of failure</td>
                <td className="bg-primary/5 border-primary/20 border-x px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </td>
                <td className="px-4 py-3">
                  <XCircle className="h-4 w-4 text-red-500" />
                </td>
                <td className="px-4 py-3">
                  <XCircle className="h-4 w-4 text-red-500" />
                </td>
                <td className="px-4 py-3">
                  <XCircle className="h-4 w-4 text-red-500" />
                </td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-3 font-medium">Fire/theft resistant</td>
                <td className="bg-primary/5 border-primary/20 border-x px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </td>
                <td className="px-4 py-3">
                  <XCircle className="h-4 w-4 text-red-500" />
                </td>
                <td className="px-4 py-3">
                  <XCircle className="h-4 w-4 text-red-500" />
                </td>
                <td className="px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-3 font-medium">No trust required</td>
                <td className="bg-primary/5 border-primary/20 border-x px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </td>
                <td className="px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </td>
                <td className="px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </td>
                <td className="px-4 py-3">
                  <XCircle className="h-4 w-4 text-red-500" />
                </td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-3 font-medium">Non-technical recipients</td>
                <td className="bg-primary/5 border-primary/20 border-x px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </td>
                <td className="px-4 py-3">
                  <XCircle className="h-4 w-4 text-red-500" />
                </td>
                <td className="px-4 py-3">
                  <XCircle className="h-4 w-4 text-red-500" />
                </td>
                <td className="px-4 py-3">
                  <XCircle className="h-4 w-4 text-red-500" />
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Cost</td>
                <td className="bg-primary/5 border-primary/20 border-x px-4 py-3 font-medium text-green-500">
                  Free plan available
                </td>
                <td className="px-4 py-3">Free (risky)</td>
                <td className="px-4 py-3">$50–200 device</td>
                <td className="px-4 py-3">$200+/hr</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="container mx-auto px-4 py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Built on Proven Cryptographic Standards
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            No proprietary magic. Just battle-tested, open-source cryptography.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <Card className="group transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <Shield className="text-primary h-6 w-6" />
                AES-256 Encryption
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                The same encryption standard used by the US government for
                classified information. Brute-forcing would take longer than the
                age of the universe.
              </p>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <Key className="text-primary h-6 w-6" />
                Shamir's Secret Sharing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Invented by cryptographer Adi Shamir (the 'S' in RSA). Splits
                your key into pieces where no single piece reveals anything
                about the original.
              </p>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <EyeOff className="text-primary h-6 w-6" />
                Zero-Knowledge Architecture
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                All encryption happens client-side in your browser. We never
                see, store, or transmit your unencrypted keys. Mathematically
                impossible for us to read.
              </p>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <Lock className="text-primary h-6 w-6" />
                Open-Source Cryptography
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Our encryption is built on open-source, peer-reviewed
                algorithms. No security through obscurity — every crypto
                holder's standard for trust.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary/5 border-t">
        <div className="container mx-auto px-4 py-24">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl">
              Don't Let Your Crypto Die With You
            </h2>
            <p className="text-muted-foreground mb-8 text-xl leading-relaxed md:text-2xl">
              Set up your first secret in under 5 minutes. Free plan includes 1
              secret and 1 recipient — enough to protect your most important
              key.
            </p>

            <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="px-8 py-6 text-lg" asChild>
                <Link href="/auth/signin">
                  Protect Your First Secret — Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="px-8 py-6 text-lg"
                asChild
              >
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>

            <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="text-accent-foreground h-4 w-4" />
                <span>Free to start</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="text-accent-foreground h-4 w-4" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="text-accent-foreground h-4 w-4" />
                <span>Setup in under 5 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
