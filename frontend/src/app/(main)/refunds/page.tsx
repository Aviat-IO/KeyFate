import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CheckCircle,
  Clock,
  RefreshCw,
  Shield,
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"

export default function RefundsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-12 space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Refund Policy</h1>
        <p className="mx-auto max-w-2xl text-xl text-gray-600">
          We want you to be completely satisfied with KeyFate. Our refund policy
          is designed to be fair and transparent.
        </p>
      </div>

      {/* Quick Overview */}
      <Card className="mb-8 border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center text-green-800">
            <CheckCircle className="mr-2 h-5 w-5" />
            30-Day Money-Back Guarantee
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-green-700">
            We offer a full 30-day money-back guarantee for all Pro
            subscriptions. If you're not satisfied for any reason, we'll provide
            a complete refund.
          </p>
        </CardContent>
      </Card>

      {/* Detailed Policy Sections */}
      <div className="grid gap-8">
        {/* Eligibility */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5 text-blue-500" />
              Refund Eligibility
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                <div>
                  <h4 className="font-medium">Pro Subscriptions</h4>
                  <p className="text-sm text-gray-600">
                    Full refund available within 30 days of purchase for both
                    monthly and annual plans
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                <div>
                  <h4 className="font-medium">Unused Portions</h4>
                  <p className="text-sm text-gray-600">
                    For annual subscriptions cancelled after 30 days, we'll
                    refund the unused portion (prorated)
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                <div>
                  <h4 className="font-medium">Billing Errors</h4>
                  <p className="text-sm text-gray-600">
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
              <Clock className="mr-2 h-5 w-5 text-orange-500" />
              Refund Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-medium text-green-700">Within 30 Days</h4>
                <p className="text-sm text-gray-600">
                  Full refund, no questions asked. Perfect if KeyFate isn't the
                  right fit for you.
                </p>
              </div>

              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-medium text-blue-700">
                  31-365 Days (Annual Plans)
                </h4>
                <p className="text-sm text-gray-600">
                  Prorated refund for the unused portion of your annual
                  subscription.
                </p>
              </div>

              <div className="border-l-4 border-gray-400 pl-4">
                <h4 className="font-medium text-gray-700">
                  Monthly Plans After 30 Days
                </h4>
                <p className="text-sm text-gray-600">
                  You can cancel anytime to avoid future charges. Current month
                  is non-refundable.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How to Request */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <RefreshCw className="mr-2 h-5 w-5 text-purple-500" />
              How to Request a Refund
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-inside list-decimal space-y-3">
              <li className="text-sm">
                <span className="font-medium">Contact Support:</span> Email us
                at{" "}
                <a
                  href="mailto:support@keyfate.com"
                  className="text-blue-600 hover:underline"
                >
                  support@keyfate.com
                </a>{" "}
                or use the in-app support chat
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
                <span className="font-medium">Receive Refund:</span> Refunds are
                issued to your original payment method and typically appear
                within 5-10 business days
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Special Circumstances */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />
              Special Circumstances
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Service Disruption</h4>
                <p className="text-sm text-gray-600">
                  If our service is unavailable for more than 24 hours due to
                  technical issues, we'll provide credits or refunds for the
                  affected period.
                </p>
              </div>

              <div>
                <h4 className="font-medium">Data Loss</h4>
                <p className="text-sm text-gray-600">
                  In the unlikely event of data loss due to our systems, we'll
                  provide a full refund and work to recover your information.
                </p>
              </div>

              <div>
                <h4 className="font-medium">Account Termination</h4>
                <p className="text-sm text-gray-600">
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
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500"></div>
                <div>
                  <p className="text-sm text-gray-600">
                    Your account will be downgraded to the Free plan immediately
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500"></div>
                <div>
                  <p className="text-sm text-gray-600">
                    You'll keep access to 1 secret and 1 recipient per secret
                    (Free plan limits)
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500"></div>
                <div>
                  <p className="text-sm text-gray-600">
                    Your existing secrets will continue to work, but you won't
                    be able to create new ones beyond the free limit
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500"></div>
                <div>
                  <p className="text-sm text-gray-600">
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
                  href="mailto:support@keyfate.com"
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  support@keyfate.com
                </a>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Response Time:</span>
                <span className="text-sm">Within 24 hours</span>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <Link
                href="/pricing"
                className="text-sm text-blue-600 hover:underline"
              >
                ← Back to Pricing
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
