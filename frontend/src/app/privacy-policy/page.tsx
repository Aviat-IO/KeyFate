import {
  NEXT_PUBLIC_COMPANY,
  NEXT_PUBLIC_PARENT_COMPANY,
  NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPPORT_EMAIL,
} from "@/lib/env"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: `${NEXT_PUBLIC_COMPANY} - Privacy Policy`,
  description: `Privacy Policy for ${NEXT_PUBLIC_COMPANY} dead man's switch service`,
}

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Privacy Policy</h1>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
        <p className="text-muted-foreground text-sm">
          <strong>Effective Date:</strong> January 2, 2025
        </p>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">1. Introduction</h2>
          <p>
            {NEXT_PUBLIC_PARENT_COMPANY} ("we," "our," or "us") operates{" "}
            {NEXT_PUBLIC_COMPANY}, a secure dead man's switch platform. This
            Privacy Policy explains how we collect, use, disclose, and safeguard
            your information when you use our service at {NEXT_PUBLIC_SITE_URL}{" "}
            (the "Service").
          </p>
          <p>
            <strong>Our Commitment to Privacy:</strong> {NEXT_PUBLIC_COMPANY} is
            designed with privacy by design principles. Secret creation and
            recovery happen 100% client-side using Shamir's Secret Sharing. We
            never receive enough information to reconstruct your secrets, as we
            only store one encrypted share that alone cannot reveal your
            sensitive information.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            2. Information We Collect
          </h2>

          <h3 className="mb-2 text-xl font-medium">
            2.1 Information You Provide
          </h3>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Account Information:</strong> Email address, name (via
              Google OAuth)
            </li>
            <li>
              <strong>Contact Methods:</strong> Email addresses and phone
              numbers for check-in reminders
            </li>
            <li>
              <strong>Recipient Information:</strong> Email addresses of
              designated recipients
            </li>
            <li>
              <strong>Secret Metadata:</strong> Titles, check-in frequencies,
              and configuration settings (but never the actual secret content)
            </li>
          </ul>

          <h3 className="mb-2 text-xl font-medium">
            2.2 Encrypted Data We Store
          </h3>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>One Encrypted Secret Share:</strong> Your secret is split
              into multiple shares using Shamir's Secret Sharing entirely on
              your device. We receive only one of these shares (which alone
              cannot reconstruct your secret), and we encrypt this share before
              storing it. Our algorithm requires at least 2 shares to
              reconstruct any secret.
            </li>
            <li>
              <strong>Cryptographic Elements:</strong> Initialization vectors
              and authentication tags for the server-side encryption of your
              share
            </li>
          </ul>

          <h3 className="mb-2 text-xl font-medium">
            2.3 Automatically Collected Information
          </h3>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Usage Data:</strong> Login times, check-in activities,
              feature usage
            </li>
            <li>
              <strong>Technical Data:</strong> IP addresses, browser type,
              device information
            </li>
            <li>
              <strong>Analytics:</strong> We may use PostHog for product
              analytics (anonymized where possible)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            3. How We Use Your Information
          </h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>Provide and maintain the {NEXT_PUBLIC_COMPANY} service</li>
            <li>Send check-in reminders via email and SMS (Twilio/SendGrid)</li>
            <li>Authenticate your identity and manage your account</li>
            <li>Notify recipients when secrets are triggered</li>
            <li>Improve our service through analytics and usage patterns</li>
            <li>Comply with legal obligations and protect against fraud</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            4. Information Sharing and Disclosure
          </h2>

          <h3 className="mb-2 text-xl font-medium">
            4.1 We Do Not Sell Your Data
          </h3>
          <p>
            We do not sell, trade, or rent your personal information to third
            parties.
          </p>

          <h3 className="mb-2 text-xl font-medium">4.2 Service Providers</h3>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Supabase:</strong> Database and authentication services
            </li>
            <li>
              <strong>Google:</strong> OAuth authentication
            </li>
            <li>
              <strong>Twilio/SendGrid:</strong> Email and SMS delivery
            </li>
            <li>
              <strong>PostHog:</strong> Product analytics (when implemented)
            </li>
          </ul>

          <h3 className="mb-2 text-xl font-medium">4.3 Secret Disclosure</h3>
          <p>
            When you fail to check in as scheduled, we will provide your
            encrypted secret share to designated recipients as part of our core
            service functionality. This is the intended purpose of the dead
            man's switch.
          </p>

          <h3 className="mb-2 text-xl font-medium">4.4 Legal Requirements</h3>
          <p>
            We may disclose information if required by law, court order, or to
            protect our rights and safety. However, due to our Shamir's Secret
            Sharing architecture, we only possess one encrypted share that
            cannot be used to reconstruct your original secrets. We cannot
            provide access to your actual secret content even if compelled to do
            so.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">5. Data Security</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>100% Client-Side Secret Processing:</strong> Secret
              creation, splitting, and recovery all happen entirely in your
              browser. Your original secret never leaves your device.
            </li>
            <li>
              <strong>Shamir's Secret Sharing:</strong> Your secret is
              mathematically split into multiple shares on your device. We
              receive only one share, which alone is mathematically useless for
              reconstructing your secret.
            </li>
            <li>
              <strong>Server-Side Encryption:</strong> The single share we
              receive is immediately encrypted using AES-256-GCM before storage.
            </li>
            <li>
              <strong>Zero-Knowledge Architecture:</strong> We never have access
              to your original secrets or enough shares to reconstruct them.
            </li>
            <li>
              <strong>Threshold Security:</strong> Our algorithm requires at
              least 2 shares to reconstruct any secret, ensuring single points
              of failure cannot compromise your data.
            </li>
            <li>
              <strong>Access Controls:</strong> Strict access controls and
              monitoring of our systems protect the encrypted shares we store.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">6. Data Retention</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Active Secrets:</strong> Retained while your account is
              active and secrets are not triggered
            </li>
            <li>
              <strong>Triggered Secrets:</strong> Retained for twice the
              original check-in period (minimum 6 months, maximum 2 years)
            </li>
            <li>
              <strong>Account Data:</strong> Deleted within 30 days of account
              deletion request
            </li>
            <li>
              <strong>Logs and Analytics:</strong> Retained for maximum 1 year
            </li>
            <li>
              <strong>Backup Data:</strong> May persist in backups for up to 90
              days after deletion
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">7. Your Rights</h2>

          <h3 className="mb-2 text-xl font-medium">7.1 All Users</h3>
          <ul className="list-disc space-y-1 pl-6">
            <li>Access and update your account information</li>
            <li>Delete your account and associated data</li>
            <li>Pause or modify your secrets</li>
            <li>Export your data (where technically feasible)</li>
          </ul>

          <h3 className="mb-2 text-xl font-medium">
            7.2 International Users (GDPR and Similar Laws)
          </h3>
          <ul className="list-disc space-y-1 pl-6">
            <li>Right to rectification of inaccurate data</li>
            <li>Right to data portability</li>
            <li>Right to restrict processing</li>
            <li>Right to object to processing</li>
            <li>Right to lodge complaints with supervisory authorities</li>
          </ul>

          <p>
            To exercise these rights, contact us at{" "}
            <a
              href={`mailto:${NEXT_PUBLIC_SUPPORT_EMAIL}`}
              className="text-blue-600 hover:underline"
            >
              {NEXT_PUBLIC_SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            8. International Data Transfers
          </h2>
          <p>
            Your data may be processed and stored in the United States and other
            countries where our service providers operate. We ensure appropriate
            safeguards are in place for international data transfers in
            compliance with applicable privacy laws.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">9. Children's Privacy</h2>
          <p>
            {NEXT_PUBLIC_COMPANY} is not intended for users under 18 years of
            age. We do not knowingly collect personal information from children
            under 18. If you become aware that a child has provided us with
            personal information, please contact us immediately.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            10. Changes to This Privacy Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify
            you of any material changes by posting the new Privacy Policy on
            this page and updating the "Effective Date" at the top. We encourage
            you to review this Privacy Policy periodically.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            11. Contact Information
          </h2>
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <p>
              <strong>{NEXT_PUBLIC_PARENT_COMPANY}</strong>
            </p>
            <p>Provo, Utah, United States</p>
            <p>
              Email:{" "}
              <a
                href={`mailto:${NEXT_PUBLIC_SUPPORT_EMAIL}`}
                className="text-blue-600 hover:underline"
              >
                {NEXT_PUBLIC_SUPPORT_EMAIL}
              </a>
            </p>
          </div>
          <p className="mt-4">
            For privacy-related inquiries, data requests, or concerns about this
            Privacy Policy, please contact us using the information above.
          </p>
        </section>
      </div>
    </div>
  )
}
