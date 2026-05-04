# KeyFate Threat Model

**Status:** Working security model for product, grant, and implementation reviews.  
**Scope:** Dead-man-switch secret storage, check-in, reminder, disclosure, and recovery flows.

## Security and privacy goals

KeyFate should keep secret contents confidential until the user's disclosure conditions are met, notify the right parties at the right time, and make the system's limits clear before users rely on it for safety-critical plans.

This document covers risks that remain even when encryption works as designed. Several risks are about timing, metadata, availability, coercion, or user behavior rather than cryptographic breakage.

## Assumptions

- The user may be unavailable, incapacitated, detained, coerced, deceased, or without network access.
- Recipients may not know they were named until disclosure, unless the user tells them earlier.
- KeyFate servers, email providers, Nostr relays, payment processors, and hosting providers can observe some metadata.
- Attackers may include account hijackers, abusive partners, employers, governments, malicious recipients, relay operators, email providers, or opportunistic link forwarders.
- KeyFate cannot guarantee physical safety, recipient cooperation, legal enforceability, or permanent service availability.

## Risk register

| Risk | What can go wrong | Mitigations | Residual risk |
| --- | --- | --- | --- |
| Early recipient discovery | A recipient or observer learns they are named before the intended trigger. Email reminders, test messages, address-book leaks, support tickets, database metadata, Nostr `p` tags, browser history, or shared devices can reveal the relationship. Early discovery can create pressure, conflict, or targeted coercion. | Make recipient notification behavior explicit in UX and docs. Avoid sending non-essential recipient messages before trigger. Minimize stored recipient metadata. Encrypt secret contents client-side. Use neutral email subjects where possible. For Nostr, prefer NIP-59 gift wraps and avoid plaintext tags beyond required routing tags. Tell users to warn trusted recipients out-of-band only when safe. | KeyFate cannot hide that an email provider delivered a message, that a relay saw an event addressed to a public key, or that a server processed recipient metadata. Users with high coercion risk should assume recipient relationships may eventually be discovered. |
| Nostr metadata leakage | Even with encrypted content, relays can observe event kind, size, timing, relay choice, recipient `p` tag for gift wraps, IP addresses unless proxied, and repeated publication patterns. Correlating disclosure broadcasts with missed check-ins may reveal an incident. | Use NIP-44 encryption and NIP-59 gift wrap for private delivery. Broadcast to multiple relays to reduce single-relay dependence. Use one-time sender keys. Avoid plaintext secret IDs, titles, or user identifiers in tags. Randomize non-critical timestamps where protocol-compatible. Document that Nostr improves availability, not perfect metadata privacy. | Public relays are adversarial by default. Required routing metadata and network-level observations remain visible. Relay operators can censor, log, correlate, or retain events. |
| Email metadata leakage | Email providers and intermediate MTAs can see sender, recipient, timestamps, subject, delivery status, IP/header metadata, and sometimes message bodies depending on transport and provider handling. Links may be scanned by anti-abuse systems before a recipient opens them. | Keep sensitive content out of subject lines and preheaders. Put only minimum necessary disclosure instructions in email. Use HTTPS links. Expire or single-use sensitive tokens where possible. Warn users that email is a notification channel, not a private channel. | Email metadata is not confidential. Provider-side link scanning can still access URLs. Recipients may forward messages or use compromised mailboxes. |
| Server log and operator metadata leakage | Application, database, CDN, host, error, analytics, or support logs can reveal account identifiers, recipient addresses, secret titles, check-in cadence, trigger timing, IPs, user agents, and failure details. Operators with production access may infer sensitive facts. | Do not log secret contents or shares. Redact tokens, email bodies, recipient details, and secret titles from error paths where possible. Restrict production access. Use least-privilege database access. Define retention limits for operational logs. Prefer aggregate metrics over user-level analytics. Review logs after security-sensitive code changes. | Some operational metadata is needed for abuse prevention, debugging, billing, email delivery, and auditability. Hosting and email vendors may retain independent logs outside KeyFate control. |
| Operator disappearance | KeyFate may shut down, lose maintainers, lose funding, lose domains, lose email provider access, or fail to run cron jobs. A valid disclosure may never happen if the service disappears before trigger. | Provide exportable recovery material and offline recovery instructions. Document dependence on KeyFate for server-held shares and scheduled disclosure. Consider Nostr or other redundant broadcast channels for triggered delivery. Maintain backup and restore procedures. Keep deployment and runbook docs current. | If KeyFate disappears before publishing or delivering needed material, users may be unable to recover. Decentralized backups reduce but do not eliminate this risk. |
| False trigger | The system may disclose too early because of clock bugs, cron races, database errors, email failures, account lockout, payment state mistakes, timezone confusion, or user misunderstanding. | Use clear check-in deadlines. Send reminders before trigger. Require conservative grace periods. Use idempotent disclosure processing. Audit trigger decisions. Test cron and retry behavior. Let users pause/delete secrets after re-authentication. | Any automated dead-man switch can fire incorrectly. High-impact secrets need independent human/legal safeguards, not only software timing. |
| Missed check-in | A user may miss check-in because they are traveling, offline, hospitalized but not intending disclosure, blocked by OAuth/email outage, rate-limited, or unable to access a device. | Offer multiple reminder windows and contact methods where available. Make check-in status prominent. Avoid overly short check-in intervals by default. Provide recovery paths for account access. Document that missed check-ins can cause disclosure. | KeyFate cannot distinguish intentional silence from benign unavailability. Short intervals increase false-trigger risk; long intervals increase delayed-disclosure risk. |
| Coercion or forced check-in | An attacker may force the user to check in, pause, delete, or alter recipients, preventing disclosure while the user is under duress. | Require re-authentication for sensitive actions. Keep audit logs visible to the user where safe. Consider future duress flows only after careful abuse review. Tell users in high-risk situations to use external safety planning, legal counsel, and trusted human escalation. | Software cannot reliably detect coercion. A visible duress feature can increase danger if discovered. Forced check-in remains a core residual risk. |
| Replay and link forwarding | Check-in or disclosure links may be copied, forwarded, scanned, replayed, or used by someone other than the intended user/recipient. Browser history, mail scanners, logs, and chat previews can expose links. | Use high-entropy tokens. Expire tokens. Prefer single-use tokens for sensitive actions. Bind destructive or account-changing actions to an authenticated session and CSRF protection. Avoid putting long-lived secrets directly in URLs. Redact tokens from logs. | Bearer links are bearer credentials. Anyone who obtains an unexpired unauthenticated link may be able to use it unless the flow requires additional authentication. |

## Channel-specific guidance

### Nostr

Use Nostr for availability and censorship resistance, not as a promise of metadata anonymity. Gift-wrapped events hide content and sender identity better than plain DMs, but relays still receive routing metadata and can correlate timing. Avoid publishing plaintext secret identifiers, titles, user emails, or recipient emails.

### Email

Use email for notification and user convenience. Do not treat it as a confidential transport. Keep subjects neutral and move sensitive details behind authenticated or expiring flows. Assume anti-spam and security products may prefetch links.

### Server operations

Treat metadata as sensitive. Secret contents and cryptographic shares must not be logged. Recipient identifiers, token strings, check-in URLs, IP addresses, and secret titles should be minimized, redacted, or retained only as long as needed for security and reliability.

## User-facing disclosure language

KeyFate should tell users, before they rely on a switch, that:

- recipients or observers may infer that a switch exists before it triggers;
- metadata can leak through email, Nostr relays, hosting providers, and logs;
- missed check-ins can disclose early, while forced check-ins can suppress disclosure;
- service shutdown or operator failure can prevent disclosure;
- high-risk users need backup plans outside KeyFate.

## Grant and roadmap relevance

Grant-facing materials should link to this threat model when discussing decentralization, Nostr delivery, custody minimization, safety, human-rights use cases, or reliability. Funding claims should distinguish mitigated risk from residual risk and avoid implying perfect secrecy, guaranteed disclosure, or coercion resistance.
