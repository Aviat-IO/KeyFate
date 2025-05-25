import {
  NEXT_PUBLIC_COMPANY,
  NEXT_PUBLIC_PARENT_COMPANY,
  NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPPORT_EMAIL,
} from "@/lib/env"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: `${NEXT_PUBLIC_COMPANY} - Terms of Service`,
  description: `Terms of Service for ${NEXT_PUBLIC_COMPANY} dead man's switch service`,
}

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Terms of Service</h1>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
        <p className="text-muted-foreground text-sm">
          <strong>Effective Date:</strong> January 2, 2025
        </p>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">1. Agreement to Terms</h2>
          <p>
            These Terms of Service ("Terms") constitute a legally binding
            agreement between you and {NEXT_PUBLIC_PARENT_COMPANY} ("Company,"
            "we," "our," or "us") regarding your use of the{" "}
            {NEXT_PUBLIC_COMPANY} service ("Service") available at{" "}
            {NEXT_PUBLIC_SITE_URL}.
          </p>
          <p>
            By accessing or using our Service, you agree to be bound by these
            Terms. If you do not agree to these Terms, you may not access or use
            the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            2. Description of Service
          </h2>
          <p>
            {NEXT_PUBLIC_COMPANY} is a digital dead man's switch platform that
            allows users to:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              Create encrypted secrets using Shamir's Secret Sharing technology
            </li>
            <li>
              Set check-in schedules to maintain control over their secrets
            </li>
            <li>
              Designate recipients who will receive access to secrets if
              check-ins are missed
            </li>
            <li>Manage and modify their secrets and check-in preferences</li>
          </ul>
          <p>
            <strong>Important:</strong> This Service is designed for legitimate
            purposes such as estate planning, emergency access to important
            information, and secure information sharing. The Service uses
            client-side Shamir's Secret Sharing where secret creation and
            recovery happen 100% on your device. We only receive one share
            (which alone cannot reconstruct your secret) and encrypt it before
            storage, ensuring we never have access to your original secrets.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">3. Eligibility</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>You must be at least 18 years old to use this Service</li>
            <li>
              You must provide accurate and complete information when creating
              an account
            </li>
            <li>
              You must have the legal capacity to enter into this agreement
            </li>
            <li>
              You may not use the Service if you are prohibited from receiving
              services under applicable law
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            4. User Responsibilities
          </h2>

          <h3 className="mb-2 text-xl font-medium">4.1 Account Security</h3>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              You are responsible for maintaining the confidentiality of your
              account credentials
            </li>
            <li>
              You must notify us immediately of any unauthorized access to your
              account
            </li>
            <li>
              You are responsible for all activities that occur under your
              account
            </li>
          </ul>

          <h3 className="mb-2 text-xl font-medium">4.2 Secret Management</h3>
          <ul className="list-disc space-y-1 pl-6">
            <li>You are solely responsible for the content of your secrets</li>
            <li>
              You must securely distribute and manage the secret shares you
              control
            </li>
            <li>You must maintain accurate recipient information</li>
            <li>
              You must check in according to your chosen schedule to prevent
              unintended disclosure
            </li>
          </ul>

          <h3 className="mb-2 text-xl font-medium">4.3 Prohibited Uses</h3>
          <p>You may not use the Service to:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              Store or transmit illegal, harmful, threatening, abusive, or
              defamatory content
            </li>
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe upon the rights of others</li>
            <li>Distribute malware, viruses, or other harmful code</li>
            <li>
              Attempt to gain unauthorized access to our systems or other users'
              accounts
            </li>
            <li>
              Use the Service for any commercial purpose without our written
              consent
            </li>
            <li>
              Store content that violates export control laws or regulations
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            5. Service Availability and Modifications
          </h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              We strive to maintain high availability but do not guarantee
              uninterrupted service
            </li>
            <li>
              We may modify, suspend, or discontinue the Service at any time
              with reasonable notice
            </li>
            <li>
              We may update these Terms from time to time; continued use
              constitutes acceptance
            </li>
            <li>
              Scheduled maintenance may temporarily affect service availability
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">6. Payment Terms</h2>
          <p>
            {NEXT_PUBLIC_COMPANY} may offer both free and paid service tiers. If
            you subscribe to a paid plan:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              Fees are charged in advance and are non-refundable except as
              required by law
            </li>
            <li>
              You authorize us to charge your payment method for applicable fees
            </li>
            <li>
              Failure to pay may result in service suspension or termination
            </li>
            <li>
              We may change pricing with 30 days' notice to existing subscribers
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            7. Privacy and Data Protection
          </h2>
          <p>
            Your privacy is important to us. Our collection and use of your
            information is governed by our Privacy Policy, which is incorporated
            into these Terms by reference. Key aspects include:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              Secret creation and recovery happen 100% client-side; we never
              receive your original secrets
            </li>
            <li>
              We only store one encrypted share using Shamir's Secret Sharing,
              which alone cannot reconstruct your secret
            </li>
            <li>
              Our algorithm requires at least 2 shares for reconstruction,
              ensuring mathematical impossibility of secret recovery from our
              servers alone
            </li>
            <li>
              We comply with applicable privacy laws including GDPR for
              international users
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            8. Intellectual Property
          </h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              The Service and its original content are owned by{" "}
              {NEXT_PUBLIC_PARENT_COMPANY} and protected by intellectual
              property laws
            </li>
            <li>
              You retain ownership of the content you store using the Service
            </li>
            <li>
              You grant us a limited license to process your encrypted data as
              necessary to provide the Service
            </li>
            <li>
              You may not copy, modify, or distribute our proprietary technology
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            9. Disclaimers and Limitation of Liability
          </h2>

          <h3 className="mb-2 text-xl font-medium">9.1 Service Disclaimers</h3>
          <div className="border-warning/20 bg-warning/10 rounded-lg border p-4">
            <p className="text-foreground mb-2 font-semibold">
              IMPORTANT DISCLAIMERS:
            </p>
            <ul className="text-foreground/80 list-disc space-y-1 pl-6">
              <li>
                THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND
              </li>
              <li>
                WE DO NOT GUARANTEE THE SECURITY, AVAILABILITY, OR FUNCTIONALITY
                OF THE SERVICE
              </li>
              <li>
                WE ARE NOT RESPONSIBLE FOR THE LOSS, CORRUPTION, OR UNAUTHORIZED
                ACCESS TO YOUR DATA
              </li>
              <li>YOU USE THE SERVICE AT YOUR OWN RISK</li>
            </ul>
          </div>

          <h3 className="mb-2 text-xl font-medium">
            9.2 Limitation of Liability
          </h3>
          <div className="border-destructive/20 bg-destructive/10 rounded-lg border p-4">
            <p className="text-foreground mb-2 font-semibold">
              LIABILITY LIMITATIONS:
            </p>
            <ul className="text-foreground/80 list-disc space-y-1 pl-6">
              <li>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW,{" "}
                {NEXT_PUBLIC_PARENT_COMPANY} SHALL NOT BE LIABLE FOR ANY
                INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
                DAMAGES
              </li>
              <li>
                OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE
                SERVICE IN THE 12 MONTHS PRECEDING THE CLAIM
              </li>
              <li>
                WE ARE NOT LIABLE FOR FAILED SECRET DISCLOSURES, MISSED
                CHECK-INS, OR TECHNICAL FAILURES
              </li>
              <li>
                WE ARE NOT LIABLE FOR THE ACTIONS OF RECIPIENTS OR THIRD PARTIES
              </li>
            </ul>
          </div>

          <h3 className="mb-2 text-xl font-medium">
            9.3 Critical Service Limitations
          </h3>
          <p>You acknowledge and agree that:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              Technical failures may prevent secret disclosure when intended
            </li>
            <li>
              Network outages, server failures, or other technical issues may
              affect service operation
            </li>
            <li>
              We cannot guarantee the delivery of notifications or secret shares
              to recipients
            </li>
            <li>
              Lost secret shares cannot be recovered if you lose access to your
              shares
            </li>
            <li>
              The Service depends on third-party providers (email, SMS, hosting)
              that may fail
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">10. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless{" "}
            {NEXT_PUBLIC_PARENT_COMPANY} and its officers, directors, employees,
            and agents from any claims, damages, losses, or expenses (including
            reasonable attorney fees) arising from:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Your use of the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of another party</li>
            <li>
              The content of your secrets or their disclosure to recipients
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">11. Termination</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>You may terminate your account at any time by contacting us</li>
            <li>
              We may terminate or suspend your account for violation of these
              Terms
            </li>
            <li>Upon termination, your access to the Service will cease</li>
            <li>
              Data retention after termination is governed by our Privacy Policy
            </li>
            <li>
              Provisions regarding liability, indemnification, and dispute
              resolution survive termination
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            12. Governing Law and Dispute Resolution
          </h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              These Terms are governed by the laws of the State of Utah, United
              States
            </li>
            <li>
              Any disputes shall be resolved in the state or federal courts
              located in Utah
            </li>
            <li>You waive any right to a jury trial</li>
            <li>
              International users retain rights under applicable local privacy
              and consumer protection laws
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">13. Miscellaneous</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              If any provision of these Terms is found unenforceable, the
              remainder shall remain in effect
            </li>
            <li>
              Our failure to enforce any right or provision does not constitute
              a waiver
            </li>
            <li>
              These Terms constitute the entire agreement between you and us
              regarding the Service
            </li>
            <li>
              We may assign these Terms; you may not assign them without our
              consent
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            14. Contact Information
          </h2>
          <div className="bg-muted rounded-lg p-4">
            <p>
              <strong>{NEXT_PUBLIC_PARENT_COMPANY}</strong>
            </p>
            <p>Provo, Utah, United States</p>
            <p>
              Email:{" "}
              <a
                href={`mailto:${NEXT_PUBLIC_SUPPORT_EMAIL}`}
                className="text-primary hover:underline"
              >
                {NEXT_PUBLIC_SUPPORT_EMAIL}
              </a>
            </p>
          </div>
          <p className="mt-4">
            For questions about these Terms of Service, please contact us using
            the information above.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">15. Acknowledgment</h2>
          <div className="border-primary/20 bg-primary/10 rounded-lg border p-4">
            <p className="text-foreground mb-2 font-semibold">
              By using {NEXT_PUBLIC_COMPANY}, you acknowledge that:
            </p>
            <ul className="text-foreground/80 list-disc space-y-1 pl-6">
              <li>
                You understand the nature and risks of a dead man's switch
                service
              </li>
              <li>
                You are responsible for managing your secret shares and check-in
                schedule
              </li>
              <li>
                Technical failures may prevent the Service from working as
                intended
              </li>
              <li>
                You have read, understood, and agree to these Terms and our
                Privacy Policy
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  )
}
