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
  CheckCircle,
  EyeOff,
  ArrowRight,
  AlertTriangle,
  Camera,
  CreditCard,
  Mail,
  Music,
  Cloud,
  FileText,
  Heart,
  Home,
  Smartphone,
  Key,
} from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Digital Estate Planning — KeyFate Dead Man's Switch",
  description:
    "Plan your digital estate with KeyFate. Ensure your family can access passwords, accounts, photos, and documents if something happens to you.",
  url: "https://keyfate.com/lp/estate",
  publisher: {
    "@type": "Organization",
    name: "KeyFate",
    url: "https://keyfate.com",
  },
}

const digitalAssets = [
  { icon: CreditCard, label: "Bank & financial accounts", detail: "Online banking, investment accounts, retirement funds" },
  { icon: Camera, label: "Photos & videos", detail: "Google Photos, iCloud, family memories spanning decades" },
  { icon: Mail, label: "Email accounts", detail: "Gmail, Outlook — the keys to resetting everything else" },
  { icon: Music, label: "Digital purchases", detail: "iTunes, Kindle, Steam — thousands in digital content" },
  { icon: Cloud, label: "Cloud storage", detail: "Dropbox, Google Drive, OneDrive — important documents" },
  { icon: Smartphone, label: "Social media accounts", detail: "Facebook, Instagram — years of memories and connections" },
  { icon: Heart, label: "Health records", detail: "Patient portals, medical history, insurance details" },
  { icon: Home, label: "Smart home & subscriptions", detail: "Utilities, insurance, streaming — all need passwords" },
]

export default function EstateLandingPage() {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="bg-background min-h-screen">
      <head>
        <title>Digital Estate Planning — Your Family Can't Access Your Passwords | KeyFate</title>
        <meta
          name="description"
          content="Traditional wills don't cover digital assets. KeyFate automatically delivers your passwords, accounts, and important documents to your family when they need them most."
        />
        <meta
          property="og:title"
          content="Your Family Can't Access Your Digital Life Without Your Passwords — KeyFate"
        />
        <meta
          property="og:description"
          content="Passwords, accounts, photos, documents — all inaccessible without you. KeyFate ensures your digital legacy reaches your loved ones automatically."
        />
        <meta property="og:url" content="https://keyfate.com/lp/estate" />
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
          <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-secondary/30 blur-2xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <Badge
            variant="outline"
            className="animate-in fade-in slide-in-from-bottom-4 mb-6 text-sm duration-700"
          >
            <FileText className="mr-2 h-3 w-3" />
            Digital Estate Planning
          </Badge>

          <h1 className="animate-in fade-in slide-in-from-bottom-6 mb-8 text-5xl font-bold tracking-tight delay-200 duration-700 md:text-7xl">
            Your Family Can't Access Your{" "}
            <span className="text-primary relative">
              Digital Life
              <div className="bg-primary/30 animate-in slide-in-from-left absolute -bottom-2 left-0 right-0 h-1 rounded-full delay-1000 duration-1000" />
            </span>{" "}
            Without Your Passwords
          </h1>

          <p className="text-muted-foreground animate-in fade-in slide-in-from-bottom-8 delay-400 my-12 text-xl leading-relaxed duration-700 md:text-2xl">
            Traditional wills don't cover digital assets.
            <br />
            <span className="text-foreground font-medium">
              Passwords, accounts, photos, documents — all inaccessible without
              you.
            </span>
          </p>

          <div className="animate-in fade-in slide-in-from-bottom-10 delay-600 mb-16 flex flex-col items-center justify-center gap-4 duration-700 sm:flex-row">
            <Button size="lg" className="px-8 py-6 text-lg" asChild>
              <Link href="/auth/signin">
                Set Up Your Digital Legacy — Free
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
              <span>Free plan available</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="text-accent-foreground h-4 w-4" />
              <span>No lawyers needed</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="text-accent-foreground h-4 w-4" />
              <span>Military-grade encryption</span>
            </div>
          </div>
        </div>
      </section>

      {/* What's at Stake Section */}
      <section className="bg-muted/30 container mx-auto px-4 py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            What's at Stake?
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            The average person has 100+ online accounts. Here's what your family
            can't access without your passwords.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {digitalAssets.map((asset) => (
            <Card
              key={asset.label}
              className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <CardHeader className="pb-2">
                <asset.icon className="text-primary mb-2 h-8 w-8 transition-transform duration-300 group-hover:scale-110" />
                <CardTitle className="text-base">{asset.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs">{asset.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Card className="border-destructive/20 bg-destructive/5 mx-auto max-w-2xl">
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-center">
                <AlertTriangle className="text-destructive mr-2 h-6 w-6" />
                <span className="font-semibold">The Hard Truth</span>
              </div>
              <p className="text-muted-foreground text-sm">
                When someone dies, tech companies make account recovery
                incredibly difficult — or impossible. Apple, Google, and
                Facebook all require lengthy legal processes that can take months
                and still fail. Many accounts are simply lost forever.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Why Not a Will Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Why a Traditional Will Isn't Enough
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            Wills were designed for physical assets. Digital lives need a
            different approach.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
          <Card className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <CardHeader>
              <AlertTriangle className="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
              <CardTitle>Passwords Change</CardTitle>
              <CardDescription>
                A will is static — your digital life isn't
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                You update passwords regularly. A will written last year already
                has outdated credentials. KeyFate lets you update secrets
                anytime — they're always current.
              </p>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <CardHeader>
              <Clock className="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
              <CardTitle>Probate Takes Months</CardTitle>
              <CardDescription>
                Your family needs access now, not in 6 months
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Wills go through probate — a legal process that takes months or
                years. Meanwhile, subscriptions charge, bills pile up, and
                accounts get locked. KeyFate delivers automatically.
              </p>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <CardHeader>
              <EyeOff className="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
              <CardTitle>Wills Are Public Record</CardTitle>
              <CardDescription>
                Your passwords would be visible to anyone
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Wills become public documents after probate. Putting passwords
                in a will means anyone can see them. KeyFate uses zero-knowledge
                encryption — only your chosen recipient can decrypt.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-muted/30 container mx-auto px-4 py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            How KeyFate Works
          </h2>
          <p className="text-muted-foreground mx-auto max-w-3xl text-xl">
            Simple setup. Automated delivery. No lawyers required.
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
              Enter your passwords, account details, or instructions. Everything
              is encrypted in your browser using{" "}
              <strong>Shamir's Secret Sharing</strong> before it ever leaves
              your device.
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
              Your secret is split into 3 encrypted pieces. We store{" "}
              <strong>1 piece</strong> (useless alone). You keep 1. Your
              recipient gets 1. Nobody can read it individually.
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
              Check in on your schedule (weekly, monthly, yearly). If you stop
              checking in, we automatically deliver our piece to your recipient
              so they can <strong>reconstruct your secrets</strong>.
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Card className="bg-muted/50 border-primary/20 mx-auto max-w-2xl">
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-center">
                <EyeOff className="text-primary mr-2 h-6 w-6" />
                <span className="font-semibold">Zero-Knowledge Promise</span>
              </div>
              <p className="text-muted-foreground text-sm">
                <strong>
                  We mathematically cannot read your secrets.
                </strong>{" "}
                All encryption happens in your browser. Even if our servers were
                compromised, your information remains secure. Only you and your
                chosen recipients can access the original data.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="container mx-auto px-4 py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Security You Can Verify
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            Built on proven, open-source cryptographic standards — not
            proprietary black boxes.
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
                The gold standard of encryption, used by governments and
                financial institutions worldwide. Your secrets are
                mathematically unbreakable.
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
                A proven cryptographic technique that splits secrets into pieces.
                No single piece reveals anything. 2 of 3 pieces needed to
                reconstruct.
              </p>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <EyeOff className="text-primary h-6 w-6" />
                Client-Side Only
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                All encryption and decryption happens in your browser. Your
                plaintext secrets never leave your device. We never see them.
              </p>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <Lock className="text-primary h-6 w-6" />
                Open-Source Algorithms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                No hidden code. Our cryptographic methods are based on
                peer-reviewed, open-source algorithms that anyone can audit and
                verify.
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
              Your Digital Legacy Deserves a Plan
            </h2>
            <p className="text-muted-foreground mb-8 text-xl leading-relaxed md:text-2xl">
              Set up in under 5 minutes. Free plan includes 1 secret and 1
              recipient — start with your most important account today.
            </p>

            <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="px-8 py-6 text-lg" asChild>
                <Link href="/auth/signin">
                  Set Up Your Digital Legacy — Free
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
                <span>No lawyers needed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
