import { Footer } from "@/components/footer"
import { NavBar } from "@/components/nav-bar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Clock, Lock, Shield } from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <div className="bg-background min-h-screen">
      <NavBar />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="text-center">
          <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-6xl">
            KeyFate
          </h1>
          <p className="text-muted-foreground mt-6 text-lg leading-8">
            Your key to peace of mind. Share your secrets with trusted contacts
            if you don't check in
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button size="lg" asChild>
              <Link href="/auth/signup">Get Started</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="#features">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-24">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <Shield className="text-primary mb-4 h-12 w-12" />
              <CardTitle>Secure Storage</CardTitle>
              <CardDescription>
                Your secrets are encrypted and stored securely
              </CardDescription>
            </CardHeader>
            <CardContent>
              Shamir's Secret Sharing happens 100% client-side. We only store
              one encrypted share that alone cannot reconstruct your secret.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Clock className="text-primary mb-4 h-12 w-12" />
              <CardTitle>Flexible Check-ins</CardTitle>
              <CardDescription>Set your own schedule</CardDescription>
            </CardHeader>
            <CardContent>
              Choose how often you need to check in. Get reminders when it's
              time.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Lock className="text-primary mb-4 h-12 w-12" />
              <CardTitle>Trusted Contacts</CardTitle>
              <CardDescription>
                Choose who receives your information
              </CardDescription>
            </CardHeader>
            <CardContent>
              Select trusted contacts to receive your secrets if you don't check
              in.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto border-t px-4 py-24">
        <h2 className="mb-16 text-center text-3xl font-bold">Simple Pricing</h2>
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Free</CardTitle>
              <CardDescription>For personal use</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-3xl font-bold">$0</p>
                <ul className="space-y-2">
                  <li>✓ 1 Secret</li>
                  <li>✓ Up to 3 contacts</li>
                  <li>✓ Basic check-in schedule</li>
                </ul>
                <Button className="w-full" asChild>
                  <Link href="/auth/signup">Get Started</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Premium</CardTitle>
              <CardDescription>For those with more to protect</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-3xl font-bold">
                  $5<span className="text-lg font-normal">/month</span>
                </p>
                <ul className="space-y-2">
                  <li>✓ Unlimited Secrets</li>
                  <li>✓ Unlimited contacts</li>
                  <li>✓ Advanced scheduling</li>
                  <li>✓ Priority support</li>
                </ul>
                <Button className="w-full" asChild>
                  <Link href="/auth/signup">Subscribe</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  )
}
