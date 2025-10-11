import { Footer } from "@/components/footer"
import { NavBar } from "@/components/nav-bar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NEXT_PUBLIC_SUPPORT_EMAIL } from "@/lib/env"
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Shield,
} from "lucide-react"
import Link from "next/link"

export default function RefundsPage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="bg-background/90 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur">
        <NavBar />
      </div>

      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-12 space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Refund Policy</h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            We want you to be completely satisfied with KeyFate. Our refund
            policy is designed to be fair and transparent.
          </p>
        </div>

        {/* Quick Overview */}
        <Card className="mb-8 border-accent/40">
          <CardHeader>
            <CardTitle className="flex items-center text-accent-foreground dark:text-accent-foreground">
              <CheckCircle className="mr-2 h-5 w-5" />
              30-Day Money-Back Guarantee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground">
              We offer a full 30-day money-back guarantee for all Pro
              subscriptions. If you're not satisfied for any reason, we'll
              provide a complete refund.
            </p>
          </CardContent>
        </Card>

        {/* Detailed Policy Sections */}
        <div className="grid gap-8">
          {/* Eligibility */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5 text-primary dark:text-primary" />
                Refund Eligibility
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-foreground dark:text-accent-foreground" />
                  <div>
                    <h4 className="font-medium">Pro Subscriptions</h4>
                    <p className="text-muted-foreground text-sm">
                      Full refund available within 30 days of purchase for both
                      monthly and annual plans
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-foreground dark:text-accent-foreground" />
                  <div>
                    <h4 className="font-medium">Unused Portions</h4>
                    <p className="text-muted-foreground text-sm">
                      For annual subscriptions cancelled after 30 days, we'll
                      refund the unused portion (prorated)
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-foreground dark:text-accent-foreground" />
                  <div>
                    <h4 className="font-medium">Billing Errors</h4>
                    <p className="text-muted-foreground text-sm">
                      Immediate full refund for any billing errors or duplicate
                      charges
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="mr-2 h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
                Refund Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="border-l-4 border-accent pl-4">
                  <h4 className="font-medium text-accent-foreground dark:text-accent-foreground">
                    Within 30 Days
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    Full refund, no questions asked. Perfect if KeyFate isn't
                    the right fit for you.
                  </p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-medium text-primary dark:text-primary">
                    31-365 Days (Annual Plans)
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    Prorated refund for the unused portion of your annual
                    subscription.
                  </p>
                </div>

                <div className="border-muted border-l-4 pl-4">
                  <h4 className="text-muted-foreground font-medium">
                    Monthly Plans After 30 Days
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    You can cancel anytime to avoid future charges. Current
                    month is non-refundable.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How to Request */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <RefreshCw className="mr-2 h-5 w-5 text-secondary-foreground dark:text-secondary-foreground" />
                How to Request a Refund
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-inside list-decimal space-y-3">
                <li className="text-sm">
                  <span className="font-medium">Contact Support:</span> Email us
                  at{" "}
                  <a
                    href={`mailto:${NEXT_PUBLIC_SUPPORT_EMAIL}`}
                    className="text-primary hover:text-primary/90 hover:underline"
                  >
                    {NEXT_PUBLIC_SUPPORT_EMAIL}
                  </a>{" "}
                </li>
                <li className="text-sm">
                  <span className="font-medium">Provide Details:</span> Include
                  your account email, subscription details, and reason for the
                  refund request
                </li>
                <li className="text-sm">
                  <span className="font-medium">Processing:</span> We'll process
                  eligible refunds within 3-5 business days and notify you once
                  complete
                </li>
                <li className="text-sm">
                  <span className="font-medium">Receive Refund:</span> Refunds
                  are issued to your original payment method and typically
                  appear within 5-10 business days
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Special Circumstances */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
                Special Circumstances
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">Service Disruption</h4>
                  <p className="text-muted-foreground text-sm">
                    If our service is unavailable for more than 24 hours due to
                    technical issues, we'll provide credits or refunds for the
                    affected period.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">Data Loss</h4>
                  <p className="text-muted-foreground text-sm">
                    In the unlikely event of data loss due to our systems, we'll
                    provide a full refund and work to recover your information.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">Account Termination</h4>
                  <p className="text-muted-foreground text-sm">
                    If we terminate your account for violations of our terms,
                    refunds will be considered on a case-by-case basis.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What Happens After Refund */}
          <Card>
            <CardHeader>
              <CardTitle>What Happens After a Refund</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="bg-primary mt-2 h-2 w-2 flex-shrink-0 rounded-full"></div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Your account will be downgraded to the Free plan
                      immediately
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="bg-primary mt-2 h-2 w-2 flex-shrink-0 rounded-full"></div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      You'll keep access to 1 secret and 1 recipient per secret
                      (Free plan limits)
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="bg-primary mt-2 h-2 w-2 flex-shrink-0 rounded-full"></div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Your existing secrets will continue to work, but you won't
                      be able to create new ones beyond the free limit
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="bg-primary mt-2 h-2 w-2 flex-shrink-0 rounded-full"></div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      You can upgrade again anytime to regain full Pro features
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                If you have questions about our refund policy or need assistance
                with your subscription, we're here to help.
              </p>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Email:</span>
                  <a
                    href={`mailto:${NEXT_PUBLIC_SUPPORT_EMAIL}`}
                    className="text-primary hover:text-primary/90 text-sm hover:underline"
                  >
                    {NEXT_PUBLIC_SUPPORT_EMAIL}
                  </a>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Response Time:</span>
                  <span className="text-sm">Within 24 hours</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <Link
                  href="/pricing"
                  className="text-primary hover:text-primary/90 text-sm hover:underline"
                >
                  ← Back to Pricing
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  )
}
