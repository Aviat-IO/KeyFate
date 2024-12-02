export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Privacy Policy</h1>

      <div className="prose dark:prose-invert max-w-none">
        <p className="text-muted-foreground mb-4">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Introduction</h2>
          <p>
            KeyFate ("we", "our", or "us") is committed to protecting your
            privacy. This policy explains how we collect, use, and safeguard
            your personal information when you use our digital dead man&apos;s
            switch service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            Information We Collect
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Account information (email address, password hash)</li>
            <li>
              Contact information for trusted contacts (email addresses, phone
              numbers)
            </li>
            <li>Encrypted message content that you choose to store</li>
            <li>Check-in timestamps and activity logs</li>
            <li>
              Authentication data from third-party providers (if you use social
              login)
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            How We Use Your Information
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>To provide and maintain our dead man&apos;s switch service</li>
            <li>
              To notify your trusted contacts according to your instructions
            </li>
            <li>
              To send you important service notifications and check-in reminders
            </li>
            <li>To improve and secure our service</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Data Security</h2>
          <p>
            We implement strong encryption and security measures to protect your
            sensitive information:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>All message content is encrypted at rest</li>
            <li>Data is transmitted securely using HTTPS</li>
            <li>We use Supabase for secure data storage and authentication</li>
            <li>Regular security audits and updates are performed</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Data Retention</h2>
          <p>
            We retain your data until you choose to delete your account or
            request data deletion. After account deletion, we may retain certain
            data for legal compliance purposes.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request data deletion</li>
            <li>Export your data</li>
            <li>Withdraw consent for data processing</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact
            us at: support@keyfate.com
          </p>
        </section>
      </div>
    </div>
  )
}
