/**
 * Email Providers Barrel Export
 *
 * Centralized exports for email provider infrastructure.
 */

export type { EmailProvider, EmailData, EmailResult } from "./EmailProvider"

export { SendGridAdapter } from "./SendGridAdapter"
export { MockAdapter } from "./MockAdapter"
