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
} from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

export default function Home() {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-background/90 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur">
        <NavBar />
      </div>

      {/* Hero Section */}
      <section className="container relative mx-auto overflow-hidden px-4 py-32">
        {/* Parallax Background Element */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            transform: `translateY(${scrollY * 0.3}px)`,
          }}
        >
          <div className="bg-primary/20 absolute left-1/4 top-1/4 h-96 w-96 rounded-full blur-3xl" />
          <div className="bg-secondary/30 absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full blur-2xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <Badge
            variant="outline"
            className="animate-in fade-in slide-in-from-bottom-4 mb-6 text-sm duration-700"
          >
            <Shield className="mr-2 h-3 w-3" />
            Zero-knowledge security
          </Badge>

          <h1 className="animate-in fade-in slide-in-from-bottom-6 mb-8 text-5xl font-bold tracking-tight delay-200 duration-700 md:text-7xl">
            Your Digital{" "}
            <span className="text-primary relative">
              Legacy
              <div className="bg-primary/30 animate-in slide-in-from-left absolute -bottom-2 left-0 right-0 h-1 rounded-full delay-1000 duration-1000" />
            </span>{" "}
            Protected
          </h1>

          <p className="text-muted-foreground animate-in fade-in slide-in-from-bottom-8 delay-400 mb-12 text-xl leading-relaxed duration-700 md:text-2xl">
            Securely share critical information with trusted contacts if you
            become unavailable.{" "}
            <span className="text-foreground font-medium">
              Perfect for crypto keys, sensitive documents, and estate planning.
            </span>
          </p>

          <div className="animate-in fade-in slide-in-from-bottom-10 delay-600 mb-16 flex flex-col items-center justify-center gap-4 duration-700 sm:flex-row">
            <Button size="lg" className="px-8 py-6 text-lg" asChild>
              <Link href="/auth/signup">
                Start Protecting Your Secrets
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

          {/* Trust Indicators */}
          <div className="text-muted-foreground animate-in fade-in slide-in-from-bottom-12 delay-800 flex flex-wrap items-center justify-center gap-8 text-sm duration-700">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Client-side encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Zero-knowledge architecture</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Open source cryptography</span>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="bg-muted/30 container mx-auto px-4 py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Trusted by Those Who Need It Most
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            When your information is critical, you need a solution you can trust
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
          <Card className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <CardHeader>
              <Key className="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
              <CardTitle>Cryptocurrency Holders</CardTitle>
              <CardDescription>
                Secure your private keys and recovery phrases
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4 text-sm">
                Ensure your family can access your crypto assets if something
                happens to you. Your private keys stay encrypted and are only
                released to trusted recipients when needed.
              </p>
              <div className="space-y-2">
                <div className="text-muted-foreground flex items-center text-xs">
                  <CheckCircle className="mr-2 h-3 w-3 text-green-500" />
                  Hardware wallet recovery phrases
                </div>
                <div className="text-muted-foreground flex items-center text-xs">
                  <CheckCircle className="mr-2 h-3 w-3 text-green-500" />
                  Exchange account details
                </div>
                <div className="text-muted-foreground flex items-center text-xs">
                  <CheckCircle className="mr-2 h-3 w-3 text-green-500" />
                  Cold storage instructions
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <CardHeader>
              <FileText className="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
              <CardTitle>Journalists & Activists</CardTitle>
              <CardDescription>
                Protect sensitive sources and information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4 text-sm">
                Safeguard critical information and source protection. If you're
                compromised, ensure trusted colleagues can continue your work
                and protect those who helped you.
              </p>
              <div className="space-y-2">
                <div className="text-muted-foreground flex items-center text-xs">
                  <CheckCircle className="mr-2 h-3 w-3 text-green-500" />
                  Source contact information
                </div>
                <div className="text-muted-foreground flex items-center text-xs">
                  <CheckCircle className="mr-2 h-3 w-3 text-green-500" />
                  Encrypted document locations
                </div>
                <div className="text-muted-foreground flex items-center text-xs">
                  <CheckCircle className="mr-2 h-3 w-3 text-green-500" />
                  Investigation handoff protocols
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <CardHeader>
              <Users className="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
              <CardTitle>Estate Planning</CardTitle>
              <CardDescription>Digital inheritance made simple</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4 text-sm">
                Ensure your digital assets and important accounts can be
                accessed by your loved ones, even during difficult or overwhelming times when immediate access is crucial.
              </p>
              <div className="space-y-2">
                <div className="text-muted-foreground flex items-center text-xs">
                  <CheckCircle className="mr-2 h-3 w-3 text-green-500" />
                  Financial account access
                </div>
                <div className="text-muted-foreground flex items-center text-xs">
                  <CheckCircle className="mr-2 h-3 w-3 text-green-500" />
                  Digital asset inventories
                </div>
                <div className="text-muted-foreground flex items-center text-xs">
                  <CheckCircle className="mr-2 h-3 w-3 text-green-500" />
                  Important document locations
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="container mx-auto px-4 py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            How KeyFate Protects Your Secrets
          </h2>
          <p className="text-muted-foreground mx-auto max-w-3xl text-xl">
            Advanced cryptography meets simple usability. Your secrets are
            mathematically impossible for us to read.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3">
          <div className="group text-center">
            <div className="mb-6">
              <div className="bg-primary/10 group-hover:bg-primary/20 mx-auto flex h-20 w-20 items-center justify-center rounded-full transition-colors duration-300">
                <Lock className="text-primary h-10 w-10" />
              </div>
            </div>
            <h3 className="mb-3 text-xl font-semibold">Create & Encrypt</h3>
            <p className="text-muted-foreground">
              Your secret is split into 3 encrypted pieces using{" "}
              <strong>Shamir's Secret Sharing</strong> - entirely in your
              browser. The original never leaves your device.
            </p>
          </div>

          <div className="group text-center">
            <div className="mb-6">
              <div className="bg-primary/10 group-hover:bg-primary/20 mx-auto flex h-20 w-20 items-center justify-center rounded-full transition-colors duration-300">
                <Shield className="text-primary h-10 w-10" />
              </div>
            </div>
            <h3 className="mb-3 text-xl font-semibold">Secure Storage</h3>
            <p className="text-muted-foreground">
              We store just <strong>1 encrypted piece</strong> (useless alone).
              You keep 1 piece. Your recipient gets 1 piece.
              <strong>2 pieces minimum</strong> needed to unlock.
            </p>
          </div>

          <div className="group text-center">
            <div className="mb-6">
              <div className="bg-primary/10 group-hover:bg-primary/20 mx-auto flex h-20 w-20 items-center justify-center rounded-full transition-colors duration-300">
                <Clock className="text-primary h-10 w-10" />
              </div>
            </div>
            <h3 className="mb-3 text-xl font-semibold">Automatic Release</h3>
            <p className="text-muted-foreground">
              If you don't check in on schedule, we send our encrypted piece to
              your recipient. They combine it with theirs to{" "}
              <strong>reconstruct your secret</strong>.
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
                <strong>We mathematically cannot read your secrets.</strong>{" "}
                Even if our servers were compromised, your information remains
                secure. Only you and your chosen recipients can reconstruct the
                original data.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Enhanced Features Section */}
      <section className="bg-muted/30 container mx-auto px-4 py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Built for Security & Peace of Mind
          </h2>
          <p className="text-muted-foreground text-xl">
            Enterprise-grade security with consumer-friendly simplicity
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="group transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <Shield className="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
              <CardTitle>Military-Grade Encryption</CardTitle>
              <CardDescription>
                AES-256 encryption with client-side Shamir's Secret Sharing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Your secrets are encrypted with the same standards used by
                governments and militaries. The cryptographic splitting happens
                entirely in your browser.
              </p>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <Clock className="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
              <CardTitle>Flexible Check-ins</CardTitle>
              <CardDescription>
                Set your own schedule from daily to yearly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Choose check-in intervals that work for your lifestyle. Get
                gentle reminders before deadlines. One-click check-ins from
                anywhere.
              </p>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <Users className="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
              <CardTitle>Trusted Recipients</CardTitle>
              <CardDescription>
                Verify recipients and customize delivery messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Email verification ensures your secrets reach the right people.
                Add custom instructions to help recipients understand what
                they're receiving.
              </p>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <Zap className="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
              <CardTitle>Instant Setup</CardTitle>
              <CardDescription>
                Start protecting your secrets in under 5 minutes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Quick and simple signup process. No complex configuration. Our
                intuitive interface guides you through creating your first
                secret.
              </p>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <Globe className="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
              <CardTitle>Global Reliability</CardTitle>
              <CardDescription>
                Robust infrastructure with worldwide availability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Built on modern cloud infrastructure. Your check-ins and
                notifications work reliably from anywhere in the world.
              </p>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <Eye className="text-primary mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
              <CardTitle>Full Transparency</CardTitle>
              <CardDescription>
                Open-source cryptography with audit trail
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Our encryption methods are based on proven, open-source
                algorithms. Full audit logs show exactly when and how your
                secrets are accessed.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="bg-primary/5 border-t">
        <div className="container mx-auto px-4 py-24">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl">
              Ready to Protect Your Digital Legacy?
            </h2>
            <p className="text-muted-foreground mb-8 text-xl leading-relaxed md:text-2xl">
              Join thousands who trust KeyFate to safeguard their most important
              information. Start with our free plan and upgrade as you grow.
            </p>

            <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="px-8 py-6 text-lg" asChild>
                <Link href="/auth/signup">
                  Get Started Free
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

            {/* Final Trust Indicators */}
            <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Free to start</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>30-day money-back guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
