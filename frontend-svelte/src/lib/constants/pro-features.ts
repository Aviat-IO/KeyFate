import { NEXT_PUBLIC_SUPPORT_EMAIL } from "$lib/env"

export interface ProFeature {
  id: string
  title: string
  description: string
  features?: string[]
}

export const PRO_FEATURES: ProFeature[] = [
  {
    id: "increased-limits",
    title: "Increased Capacity",
    description: "More secrets and recipients for comprehensive protection",
    features: [
      "Up to 10 secrets (vs 1 on Free)",
      "Up to 5 recipients per secret (vs 1 on Free)",
      "Flexible check-in intervals: 1 day to 3 years",
    ],
  },
  {
    id: "message-templates",
    title: "Message Templates",
    description: "Pre-written templates for common scenarios to save time",
    features: [
      "Bitcoin Wallet Access",
      "Password Manager Master Password",
      "Estate Planning Documents",
      "Safe Deposit Box Instructions",
      "Cryptocurrency Exchange Account",
      "Cloud Storage Access",
      "Social Media Account Access",
    ],
  },
  {
    id: "configurable-threshold",
    title: "Configurable Security",
    description: "Customize Shamir's Secret Sharing threshold for your needs",
    features: [
      "Choose 2-of-3 up to 7 total shares",
      "Examples: 3-of-5, 4-of-7 for higher security",
      "Free tier locked to 2-of-3",
    ],
  },
  {
    id: "audit-logs",
    title: "Comprehensive Audit Logs",
    description: "Track all activity for security and compliance",
    features: [
      "Secret creation, editing, deletion",
      "Check-in history",
      "Recipient changes",
      "Secret triggers",
      "Login events",
      "Subscription changes",
      "Export to CSV/JSON",
      "Stored indefinitely",
    ],
  },
  {
    id: "priority-support",
    title: "Priority Email Support",
    description: "Direct access to our support team for faster assistance",
    features: [
      `Email: ${NEXT_PUBLIC_SUPPORT_EMAIL || 'support@keyfate.com'}`,
      "Response within 72 hours",
    ],
  },
]

export function getProFeatureById(id: string): ProFeature | undefined {
  return PRO_FEATURES.find((feature) => feature.id === id)
}

export function getProFeatureTitles(): string[] {
  return PRO_FEATURES.map((feature) => feature.title)
}

export function getProFeatureDescriptions(): string[] {
  return PRO_FEATURES.map((feature) => feature.description)
}

export const PRO_FEATURE_IDS = {
  INCREASED_LIMITS: "increased-limits",
  MESSAGE_TEMPLATES: "message-templates",
  CONFIGURABLE_THRESHOLD: "configurable-threshold",
  AUDIT_LOGS: "audit-logs",
  PRIORITY_SUPPORT: "priority-support",
} as const
