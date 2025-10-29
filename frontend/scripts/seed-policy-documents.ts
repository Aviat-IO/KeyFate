/**
 * Seed script to store policy documents in the database
 * Run with: npx tsx scripts/seed-policy-documents.ts
 */

import { getDatabase } from "../src/lib/db/drizzle"
import { policyDocuments } from "../src/lib/db/schema"
import { eq, and } from "drizzle-orm"

const PRIVACY_POLICY_V1 = `# Privacy Policy

**Effective Date:** January 2, 2025  
**Version:** 1.0.0

## 1. Introduction

KeyFate is a secure dead man's switch platform designed with privacy by design principles. Secret creation and recovery happen 100% client-side using Shamir's Secret Sharing. We never receive enough information to reconstruct your secrets, as we only store one encrypted share that alone cannot reveal your sensitive information.

This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.

## 2. Information We Collect

### 2.1 Information You Provide
- Email address (for authentication and notifications)
- Recipient contact information (names, emails, phone numbers)
- Check-in frequency preferences
- Payment information (processed by third-party payment processors)

### 2.2 Information We Do Not Collect
- Your original secrets (these are split client-side)
- Complete encryption keys (we only store one Shamir share)
- Passwords (we use passwordless OTP authentication)

### 2.3 Automatically Collected Information
- Log data (IP addresses, browser type, pages visited)
- Usage patterns (check-in timestamps, feature usage)
- Authentication events (login attempts, OTP requests)

## 3. How We Use Your Information

We use your information to:
- Provide and maintain the Service
- Send check-in reminders and security notifications
- Process payments and manage subscriptions
- Improve our Service and develop new features
- Detect and prevent fraud or abuse
- Comply with legal obligations

## 4. Data Sharing and Disclosure

We do not sell your personal information. We may share data with:
- **Payment Processors**: Stripe or BTCPay for payment processing
- **Email Service Providers**: For sending notifications and OTP codes
- **Law Enforcement**: When required by law or to protect rights and safety
- **Designated Recipients**: When your dead man's switch is triggered

## 5. Data Security

We implement industry-standard security measures:
- End-to-end encryption for secrets (client-side using Shamir's Secret Sharing)
- Encrypted database storage
- Secure authentication (passwordless OTP with rate limiting)
- Regular security audits and monitoring
- Access controls and logging

## 6. Data Retention

- Active accounts: Data retained while account is active
- Triggered secrets: Disclosed to recipients and purged after 90 days
- Audit logs: Retained for 90 days (Free) or indefinitely (Pro)
- Deleted accounts: All data permanently deleted within 30 days

## 7. Your Rights

You have the right to:
- Access your personal data
- Correct inaccurate data
- Delete your account and data
- Export your data (excluding encrypted shares)
- Object to certain data processing
- Withdraw consent at any time

To exercise these rights, contact us at support@keyfate.com

## 8. International Data Transfers

We operate globally and may transfer data to countries outside your jurisdiction. We ensure appropriate safeguards are in place to protect your data.

## 9. Children's Privacy

Our Service is not intended for users under 18. We do not knowingly collect information from children.

## 10. Changes to This Policy

We may update this Privacy Policy periodically. We will notify you of material changes via email or Service notification. Continued use after changes constitutes acceptance.

## 11. Contact Us

For privacy questions or concerns:
- Email: support@keyfate.com
- Company: KeyFate (operated by Slyph Ltd.)
`

const TERMS_OF_SERVICE_V1 = `# Terms of Service

**Effective Date:** January 2, 2025  
**Version:** 1.0.0

## 1. Agreement to Terms

These Terms of Service constitute a legally binding agreement between you and KeyFate regarding your use of the Service. By accessing or using our Service, you agree to be bound by these Terms.

## 2. Description of Service

KeyFate is a dead man's switch service that:
- Stores encrypted secrets using Shamir's Secret Sharing
- Monitors user check-ins according to configurable schedules
- Automatically discloses secrets to designated recipients if check-ins are missed
- Provides client-side encryption ensuring zero-knowledge architecture

## 3. User Responsibilities

You agree to:
- Provide accurate and current information
- Maintain the security of your account
- Check in according to your configured schedule
- Use the Service only for lawful purposes
- Not attempt to circumvent security measures
- Not store illegal content or content that violates others' rights

## 4. Prohibited Uses

You may not use the Service to:
- Store illegal content or facilitate illegal activities
- Harass, threaten, or harm others
- Distribute malware or malicious code
- Infringe intellectual property rights
- Violate export control laws
- Impersonate others or provide false information

## 5. Service Availability

We strive for 99.9% uptime but cannot guarantee uninterrupted service. We are not liable for:
- Service outages or disruptions
- Data loss due to technical failures
- Missed notifications due to email delivery issues
- Consequences of failed check-ins or premature disclosures

## 6. Subscription and Payments

### 6.1 Free Tier
- Limited to 2 secrets
- 3 recipients per secret
- 90-day audit log retention

### 6.2 Pro Tier ($X/month)
- Unlimited secrets and recipients
- Priority support
- Indefinite audit log retention
- Advanced features

### 6.3 Payment Terms
- Payments processed by Stripe or BTCPay
- Subscriptions auto-renew unless cancelled
- Refunds subject to our refund policy
- We reserve the right to change pricing with 30 days notice

## 7. Data Ownership and License

You retain all rights to your data. By using the Service, you grant us a limited license to:
- Store and process your data as necessary to provide the Service
- Disclose encrypted shares to recipients when triggered
- Use aggregated, anonymized data for analytics

## 8. Intellectual Property

The Service, including all software, designs, and content, is owned by KeyFate and protected by intellectual property laws. You may not:
- Copy or modify our software
- Reverse engineer our systems
- Use our trademarks without permission

## 9. Termination

We may terminate or suspend your account if you:
- Violate these Terms
- Engage in fraudulent activity
- Fail to pay subscription fees
- Request account deletion

Upon termination:
- Your data will be deleted within 30 days
- Active secrets will be disclosed to recipients
- Subscription fees are non-refundable

## 10. Disclaimers

THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

## 11. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, KEYFATE SHALL NOT BE LIABLE FOR:
- INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES
- LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES
- DAMAGES EXCEEDING THE AMOUNT YOU PAID IN THE PAST 12 MONTHS

## 12. Indemnification

You agree to indemnify and hold harmless KeyFate from claims arising from:
- Your use of the Service
- Your violation of these Terms
- Your violation of third-party rights
- Content you store or disclose through the Service

## 13. Dispute Resolution

### 13.1 Governing Law
These Terms are governed by the laws of [Jurisdiction], without regard to conflict of law principles.

### 13.2 Arbitration
Disputes shall be resolved through binding arbitration, except for:
- Small claims court actions
- Intellectual property disputes
- Equitable relief

## 14. Changes to Terms

We may modify these Terms at any time. Material changes will be notified via email or Service notification. Continued use after changes constitutes acceptance.

## 15. Miscellaneous

### 15.1 Entire Agreement
These Terms constitute the entire agreement between you and KeyFate.

### 15.2 Severability
If any provision is found unenforceable, the remaining provisions remain in effect.

### 15.3 Waiver
Our failure to enforce any right does not constitute a waiver.

### 15.4 Assignment
You may not assign these Terms. We may assign our rights without restriction.

## 16. Contact Information

For questions about these Terms:
- Email: support@keyfate.com
- Company: KeyFate (operated by Slyph Ltd.)
`

async function seedPolicyDocuments() {
  try {
    const db = await getDatabase()

    console.log("Checking for existing policy documents...")

    // Check if privacy policy v1.0.0 exists
    const existingPrivacy = await db
      .select()
      .from(policyDocuments)
      .where(
        and(
          eq(policyDocuments.type, "privacy_policy"),
          eq(policyDocuments.version, "1.0.0"),
        ),
      )
      .limit(1)

    if (existingPrivacy.length === 0) {
      console.log("Inserting Privacy Policy v1.0.0...")
      await db.insert(policyDocuments).values({
        type: "privacy_policy",
        version: "1.0.0",
        content: PRIVACY_POLICY_V1,
        effectiveDate: new Date("2025-01-02"),
      })
      console.log("✓ Privacy Policy v1.0.0 inserted")
    } else {
      console.log("✓ Privacy Policy v1.0.0 already exists")
    }

    // Check if terms of service v1.0.0 exists
    const existingTerms = await db
      .select()
      .from(policyDocuments)
      .where(
        and(
          eq(policyDocuments.type, "terms_of_service"),
          eq(policyDocuments.version, "1.0.0"),
        ),
      )
      .limit(1)

    if (existingTerms.length === 0) {
      console.log("Inserting Terms of Service v1.0.0...")
      await db.insert(policyDocuments).values({
        type: "terms_of_service",
        version: "1.0.0",
        content: TERMS_OF_SERVICE_V1,
        effectiveDate: new Date("2025-01-02"),
      })
      console.log("✓ Terms of Service v1.0.0 inserted")
    } else {
      console.log("✓ Terms of Service v1.0.0 already exists")
    }

    console.log("\n✅ Policy documents seeded successfully!")
    process.exit(0)
  } catch (error) {
    console.error("❌ Error seeding policy documents:", error)
    process.exit(1)
  }
}

seedPolicyDocuments()
