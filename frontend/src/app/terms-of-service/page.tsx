export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Terms of Service</h1>

      <div className="prose dark:prose-invert max-w-none">
        <p className="text-muted-foreground mb-4">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            1. Service Description
          </h2>
          <p>
            KeyFate provides a digital dead man&apos;s switch service that
            allows users to set up automated notifications to trusted contacts
            if they fail to check in within a specified timeframe.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            2. User Responsibilities
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              You must provide accurate and up-to-date contact information
            </li>
            <li>
              You are responsible for maintaining the confidentiality of your
              account credentials
            </li>
            <li>
              You must not use the service for any illegal or unauthorized
              purpose
            </li>
            <li>
              You are responsible for checking in according to your configured
              schedule
            </li>
            <li>
              You must obtain consent from trusted contacts before adding them
              to the service
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            3. Service Reliability
          </h2>
          <p>
            While we strive for high reliability, we cannot guarantee 100%
            uptime or message delivery. The service should not be used as a
            primary emergency response system.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">4. Content Guidelines</h2>
          <p>You agree not to store or transmit:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Illegal content</li>
            <li>Malicious software</li>
            <li>Content that violates others&apos; rights</li>
            <li>Spam or unsolicited messages</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            5. Limitation of Liability
          </h2>
          <p>We are not liable for any damages or losses resulting from:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Service interruptions or failures</li>
            <li>Delayed or undelivered notifications</li>
            <li>Unauthorized access to your account</li>
            <li>False triggers of your dead man&apos;s switch</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            6. Account Termination
          </h2>
          <p>
            We reserve the right to suspend or terminate accounts that violate
            these terms or pose a security risk. You may delete your account at
            any time.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">7. Changes to Terms</h2>
          <p>
            We may modify these terms at any time. Continued use of the service
            after changes constitutes acceptance of the new terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">8. Contact</h2>
          <p>
            For questions about these terms, please contact us at:
            support@keyfate.com
          </p>
        </section>
      </div>
    </div>
  )
}
