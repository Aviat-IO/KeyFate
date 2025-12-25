import { Footer } from "@/components/footer"
import { NavBar } from "@/components/nav-bar"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Shield, Lock, Clock, Users, Download, Globe } from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "FAQ - KeyFate",
  description:
    "Frequently asked questions about KeyFate's dead man's switch service, security, and business continuity.",
}

export const dynamic = "force-static"
export const revalidate = 3600

const faqs = [
  {
    category: "Security & Privacy",
    icon: Shield,
    questions: [
      {
        question: "Can KeyFate read my secrets?",
        answer:
          "No, mathematically impossible. Your secrets are encrypted client-side using Shamir's Secret Sharing before anything leaves your browser. We only store ONE encrypted share out of the required threshold (e.g., 2-of-3). This single share is useless on its own – even if our servers were completely compromised, your secrets remain secure.",
      },
      {
        question: "How does Shamir's Secret Sharing work?",
        answer:
          "Shamir's Secret Sharing is a cryptographic algorithm that splits a secret into multiple pieces (shares). You configure a threshold – for example, 2-of-3 means the secret is split into 3 shares, and any 2 are needed to reconstruct it. KeyFate stores 1 share, you keep 1, and your recipient gets 1. No single party can access the secret alone.",
      },
      {
        question: "What encryption does KeyFate use?",
        answer:
          "We use AES-256-GCM for encrypting shares (the same standard used by governments and militaries), combined with Shamir's Secret Sharing for splitting secrets. All cryptographic operations happen in your browser using proven, open-source libraries.",
      },
    ],
  },
  {
    category: "Business Continuity",
    icon: Globe,
    questions: [
      {
        question: "What happens if KeyFate goes out of business?",
        answer:
          "This is a legitimate concern, and we've designed for it. First, your secrets are YOURS – we only hold one share. We're committed to: (1) Providing share export functionality so you can backup your server-stored share, (2) 90+ days notice if we ever shut down, (3) Open-sourcing our reconstruction tools so you can always recover secrets with your shares. We're also building Nostr integration for censorship-resistant disclosure that doesn't depend on our servers at all.",
      },
      {
        question: "What if KeyFate's servers go down temporarily?",
        answer:
          "Our infrastructure runs on Google Cloud with multiple redundancy layers. If there's temporary downtime: (1) Your secrets remain encrypted and safe, (2) We send 7 reminder emails before any deadline (at 25%, 50%, 7 days, 3 days, 24 hours, 12 hours, and 1 hour), (3) Any reminders missed during an outage are automatically retried within a 7-day window, (4) You can check in anytime once we're back online. If disclosure emails fail, they retry with exponential backoff up to 5 times.",
      },
      {
        question: "Can I export my data and shares?",
        answer:
          "Yes! We believe in data sovereignty. You can export your server-stored share as an encrypted backup file. With all shares in hand (yours, recipient's, and the exported server share), you can reconstruct your secret using our open-source tools – no KeyFate servers required.",
      },
      {
        question: "Is KeyFate open source?",
        answer:
          "Our cryptographic libraries and reconstruction tools are open source. We're committed to transparency in how your data is protected. You can verify our encryption implementations and, if needed, reconstruct secrets independently.",
      },
    ],
  },
  {
    category: "How It Works",
    icon: Lock,
    questions: [
      {
        question: "How do check-ins work?",
        answer:
          "You choose a check-in interval (from 1 day to 3 years for Pro users). We send reminder emails before your deadline – at 25%, 50%, 7 days, 3 days, 24 hours, 12 hours, and 1 hour before. One click confirms you're okay. If you miss ALL reminders and the deadline, we disclose your server share to your recipient.",
      },
      {
        question: "What does my recipient receive if I don't check in?",
        answer:
          "Your recipient receives our encrypted share plus instructions for combining it with their share. They'll need both pieces to reconstruct your secret. We also send any custom message you've written to help them understand what they're receiving.",
      },
      {
        question: "Can I have multiple secrets and recipients?",
        answer:
          "Free tier: 1 secret with 1 recipient. Pro tier: Up to 10 secrets with 5 recipients each. Each secret can have its own check-in schedule, threshold configuration, and custom message. Note: All recipients of a secret receive the same share from KeyFate—we only ever store one share per secret. Recipients must combine our share with their own to reconstruct the secret.",
      },
    ],
  },
  {
    category: "Account & Billing",
    icon: Users,
    questions: [
      {
        question: "What's included in the free tier?",
        answer:
          "1 secret, 1 recipient, 3 check-in intervals (1 week, 1 month, 1 year), and 2-of-3 share threshold. Perfect for trying KeyFate or simple use cases.",
      },
      {
        question: "What do I get with Pro?",
        answer:
          "10 secrets, 5 recipients per secret, 9 flexible intervals (1 day to 3 years), configurable thresholds (2-of-N up to 7 shares), 7 message templates, comprehensive audit logs, and priority support.",
      },
      {
        question: "What happens if I downgrade from Pro to Free?",
        answer:
          "Your existing secrets are grandfathered – they stay active and continue working. You just can't create new secrets if you're over the free tier limit. We never delete your data due to a downgrade.",
      },
      {
        question: "Do you offer refunds?",
        answer:
          "Yes, we offer a 30-day money-back guarantee. If KeyFate isn't right for you, contact support for a full refund.",
      },
    ],
  },
  {
    category: "Future Features",
    icon: Clock,
    questions: [
      {
        question: "What's on your roadmap?",
        answer:
          "We're actively working on: (1) Share export/backup functionality, (2) Nostr integration for censorship-resistant disclosure, (3) Offline reconstruction tools, (4) SMS notifications, (5) Multi-provider storage redundancy. Our goal is making KeyFate increasingly resilient and user-controlled.",
      },
      {
        question: "What is Nostr integration?",
        answer:
          "Nostr is a decentralized protocol for censorship-resistant communication. We're building integration that allows secret disclosure through the Nostr network – meaning even if KeyFate servers are down, your secrets can still be delivered to recipients through the distributed Nostr relay network.",
      },
    ],
  },
]

export default function FAQPage() {
  return (
    <div className="bg-background min-h-screen">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <NavBar />
      </nav>

      <div className="h-16" />

      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <Badge variant="outline" className="mb-4">
              <Shield className="mr-2 h-3 w-3" />
              Frequently Asked Questions
            </Badge>
            <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
              How can we help?
            </h1>
            <p className="text-muted-foreground text-lg">
              Everything you need to know about KeyFate's security, features,
              and how we protect your digital legacy.
            </p>
          </div>

          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Download className="text-primary mt-1 h-6 w-6 flex-shrink-0" />
                <div>
                  <h3 className="mb-2 font-semibold">
                    Your Secrets, Your Control
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    KeyFate is designed so you're never locked in. We store only
                    what's mathematically useless alone, you can export your
                    data anytime, and our reconstruction tools are open source.
                    Even if we disappear, your secrets remain recoverable.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-8">
            {faqs.map((category) => (
              <div key={category.category}>
                <div className="mb-4 flex items-center gap-2">
                  <category.icon className="text-primary h-5 w-5" />
                  <h2 className="text-xl font-semibold">{category.category}</h2>
                </div>
                <Accordion type="single" collapsible className="w-full">
                  {category.questions.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`${category.category}-${index}`}
                    >
                      <AccordionTrigger className="text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>

          <Card className="mt-12 text-center">
            <CardContent className="pt-6">
              <h3 className="mb-2 font-semibold">Still have questions?</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Can't find what you're looking for? We're here to help.
              </p>
              <a
                href="mailto:support@keyfate.com"
                className="text-primary hover:underline"
              >
                Contact Support →
              </a>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  )
}
