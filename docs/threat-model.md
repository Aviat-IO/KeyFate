# KeyFate threat model

## Scope

This threat model covers KeyFate's dead man's switch workflow: account access, secret creation, encrypted storage, check-ins, reminders, triggered disclosure, recipient recovery, deletion, audit logging, and planned Nostr-based redundant disclosure.

It does not claim that KeyFate can protect users from every endpoint compromise, legal order, physical coercion, or insecure secret they enter. It defines what the project must defend, what it can only reduce, and what remains residual risk.

## Security goals

1. KeyFate operators and attackers who compromise only the server must not be able to read user plaintext secrets.
2. Secrets must disclose only to user-designated recipients after the configured check-in failure conditions are met.
3. Disclosure processing must be idempotent: retries must not create inconsistent state or duplicate harmful actions.
4. Recipients must be able to recover secrets without uploading shares to unknown third parties.
5. Users and auditors must be able to understand the data collected, trust boundaries, and failure modes.
6. The service should remain useful under partial censorship, email blocking, provider outages, or company shutdown.

## Non-goals and limits

- KeyFate cannot protect plaintext typed into a compromised browser, infected device, hostile password manager, or malicious clipboard.
- KeyFate cannot prove that a missed check-in means death or incapacity; it can only execute the user's preconfigured policy.
- KeyFate cannot stop a recipient from mishandling a disclosed secret after recovery.
- KeyFate cannot make weak user secrets strong.
- KeyFate cannot guarantee Nostr relay persistence or email delivery.
- KeyFate cannot defeat lawful compulsion against operators, but cryptographic minimization should limit what operators can reveal.

## Assets

| Asset | Why it matters | Desired protection |
| --- | --- | --- |
| Plaintext secret content | May contain wallet seeds, credentials, source material, legal documents, or emergency instructions | Never available to KeyFate servers in plaintext |
| Secret shares / encrypted shares | Reconstruction material for disclosure | Confidentiality, integrity, threshold enforcement |
| Encryption keys and key derivation material | Protects stored secret data | Client-side control where possible; no logging |
| Check-in tokens | Can prove user liveness or affect timing | Unpredictable, single-purpose, expiring, protected from replay |
| Recipient identities and contact routes | Sensitive social graph and target list | Minimize exposure; protect against enumeration |
| Disclosure state | Determines when recipients receive material | Strong authorization, auditability, idempotency |
| Audit logs | Evidence for user/account events | Tamper resistance without leaking secrets |
| Payment/subscription records | Personal and financial metadata | Least privilege and provider isolation |
| Nostr disclosure events | Redundant delivery route | End-to-end content secrecy and metadata awareness |

## Actors

- **User:** creates secrets, recipients, and check-in policy.
- **Recipient:** receives instructions or shares after disclosure conditions are met.
- **KeyFate operator:** deploys and administers the service.
- **External attacker:** attempts account takeover, brute force, injection, denial of service, or secret theft.
- **Malicious insider:** has privileged infrastructure or database access.
- **Coercer:** pressures user or recipient to disclose, miss check-ins, or change settings.
- **Censor/provider:** blocks email, domain access, payment, hosting, or relay traffic.
- **Compromised dependency:** malicious package, relay, email provider, OAuth provider, or payment provider.

## Trust boundaries

1. **Browser/device boundary:** plaintext may exist in the user's browser during creation and recipient recovery. This is the highest-risk boundary.
2. **Application server boundary:** server handles authentication, persistence, reminders, disclosure state, email, payments, and Nostr publication. It should not need plaintext secret content.
3. **Database boundary:** stores user records, recipient data, encrypted secret material, disclosure metadata, audit logs, and job state.
4. **Email provider boundary:** sees message metadata and may see recovery links or recipient contact details.
5. **Nostr relay boundary:** sees event metadata and relay publication timing; should not see plaintext disclosure content.
6. **Payment provider boundary:** sees billing metadata independent of secret contents.
7. **Operator tooling boundary:** logs, backups, admin dashboards, and migrations can expose sensitive metadata if mishandled.

## Primary attack paths and mitigations

### 1. Server compromise attempts to read all secrets

**Attack:** attacker gains database and application access, dumps encrypted secret records, recipient records, logs, and backups.

**Mitigations:**

- Keep plaintext secret content out of server-side persistence.
- Use client-side encryption and threshold secret sharing for reconstruction material.
- Avoid logging plaintext, keys, shares, recovery tokens, or decrypted content.
- Encrypt backups and restrict production database access.
- Separate application secrets, database credentials, payment secrets, and email credentials.

**Residual risk:** metadata such as user email, recipient email, check-in timing, secret titles, and disclosure status may still be sensitive. If implementation accidentally sends plaintext to the server, the model fails.

### 2. Account takeover changes recipients or prevents disclosure

**Attack:** attacker compromises a user account, adds themselves as recipient, deletes secrets, changes check-in cadence, or checks in to suppress disclosure.

**Mitigations:**

- Require strong authentication and re-authentication for sensitive operations.
- Send out-of-band notifications for recipient, cadence, deletion, and disclosure-policy changes.
- Keep audit history for security-relevant account events.
- Rate-limit login, OTP, recovery, and check-in token workflows.
- Consider delayed activation for high-risk recipient changes.

**Residual risk:** if the user's email/OAuth account is compromised, attacker power may be broad. Delayed changes and recipient notifications reduce but do not eliminate this risk.

### 3. False trigger discloses a live user's secret

**Attack:** network outage, email delivery failure, scheduler bug, cron concurrency, malicious operator action, or denial of service causes missed check-ins and premature disclosure.

**Mitigations:**

- Use explicit grace periods, reminders, retry windows, and clear countdown UX.
- Make disclosure state transitions idempotent and test-covered.
- Prevent concurrent cron workers from processing the same secret twice.
- Record every reminder, check-in, failure, and disclosure attempt.
- Add operator emergency pause controls that do not expose plaintext.

**Residual risk:** no dead man's switch can distinguish all incapacity from connectivity loss. Users with high censorship risk need conservative timing and redundant check-in channels.

### 4. Malicious or compromised recipient reconstructs early

**Attack:** recipient obtains enough shares before disclosure or tricks the user into revealing additional material.

**Mitigations:**

- Use threshold designs where no single recipient-side item is sufficient before disclosure.
- Keep user instructions clear about never sharing their retained material prematurely.
- Provide recipient role explanations and warnings.
- Consider multisig or multiple-recipient threshold policies for high-value Bitcoin use.

**Residual risk:** social engineering and unsafe user storage can defeat cryptography.

### 5. Email provider blocks or leaks disclosure

**Attack:** email bounces, spam filtering, provider shutdown, account suspension, or provider-side surveillance prevents or observes delivery.

**Mitigations:**

- Treat email as a compatibility channel, not a sole trust anchor.
- Add retry, bounce logging, and user-visible delivery status where appropriate.
- Move toward Nostr gift-wrapped disclosure and offline recovery bundles.
- Keep email content minimal; avoid plaintext secrets in email.

**Residual risk:** email metadata can reveal that a user uses KeyFate and who their recipients are.

### 6. Nostr relay metadata leakage or non-delivery

**Attack:** relays drop events, correlate publication timing, censor recipients, or preserve metadata longer than expected.

**Mitigations:**

- Encrypt content using modern Nostr encryption primitives such as NIP-44.
- Use NIP-59 gift wrapping where feasible to reduce sender/recipient metadata exposure.
- Publish to multiple relays and record relay status.
- Document relay assumptions and recipient setup requirements.

**Residual risk:** relay timing, recipient tags, IP metadata, and event persistence can leak information. Nostr improves delivery resilience but does not make disclosure anonymous.

### 7. Insider abuses admin access

**Attack:** privileged operator queries sensitive metadata, changes disclosure state, tampers with jobs, or disables reminders.

**Mitigations:**

- Apply least-privilege production access.
- Require audited administrative actions.
- Use deployment secrets and database roles scoped to need.
- Keep plaintext secret recovery impossible for admins by design.
- Document break-glass procedures and review logs after use.

**Residual risk:** operators can still harm availability and metadata privacy. Open-source deployment and self-hosting can reduce reliance on one operator.

### 8. Dependency or supply-chain compromise

**Attack:** malicious dependency, build step, CI secret leak, or compromised package injects code that exfiltrates plaintext in the browser or server.

**Mitigations:**

- Pin dependencies with lockfiles.
- Review cryptographic dependency updates carefully.
- Keep CI secrets least-privileged.
- Prefer reproducible/offline recovery artifacts for critical flows.
- Add security review for code that touches plaintext, keys, shares, tokens, or disclosure state.

**Residual risk:** browser-side cryptography depends heavily on delivered JavaScript integrity.

### 9. Denial of service prevents check-in or recovery

**Attack:** attacker blocks the web app, database, email, or DNS; user cannot check in; recipient cannot access recovery page.

**Mitigations:**

- Conservative grace periods and reminders.
- Independent recovery docs and offline reconstruction path.
- Redundant disclosure channel through Nostr.
- Backups and deployment runbooks.

**Residual risk:** targeted censorship can still interfere with live check-ins. Users in hostile networks need alternate access paths and longer windows.

### 10. Data deletion and retention failure

**Attack:** deleted secrets remain in logs, backups, dead-letter queues, exports, or provider systems.

**Mitigations:**

- Define deletion lifecycle for active database records, backups, audit logs, email queues, and exports.
- Avoid storing plaintext anywhere in logs or third-party systems.
- Keep retention periods visible to users.
- Test deletion jobs and backup restore behavior.

**Residual risk:** backups and third-party provider logs may retain metadata after user-visible deletion.

## Abuse cases

- Stalker creates a secret naming an unwilling recipient to harass them.
- User stores illegal or dangerous material and attempts to force delivery.
- Attacker uses KeyFate emails for phishing recipients.
- Coercer forces a user to add the coercer as recipient.
- User sets an unsafe short interval and triggers accidental disclosure during travel or outage.

Required controls include recipient consent/verification where practical, abuse reporting, rate limits, clear email branding, delayed sensitive changes for high-risk modes, and user education about safe check-in intervals.

## Security requirements checklist

- [ ] No plaintext secret content in server logs, database records, analytics, email, or payment metadata.
- [ ] Sensitive account changes require re-authentication.
- [ ] Disclosure jobs are idempotent and concurrency-safe.
- [ ] Check-in tokens are random, scoped, expiring, and replay-resistant.
- [ ] Recipient recovery can be performed without trusting arbitrary online tools.
- [ ] Nostr disclosure content is encrypted; relay metadata risks are documented.
- [ ] Backups are encrypted and access controlled.
- [ ] Audit logs capture security events without leaking secrets.
- [ ] Rate limits cover login, OTP, recovery, check-in, secret creation, and disclosure endpoints.
- [ ] Incident runbooks cover disclosure pause, provider outage, key compromise, and database restore.

## Open review questions

These should remain visible until answered by implementation or audit:

1. Which secret fields are encrypted client-side today, and which are only protected by server-side encryption?
2. Does any current recovery or decrypt endpoint receive plaintext shares that should stay local-only?
3. Are disclosure cron jobs protected against overlapping execution in every deployment target?
4. What metadata is included in reminder and disclosure emails?
5. What exact retention period applies to deleted secrets, backups, dead-letter emails, audit logs, and payment records?
6. What recipient-consent model is required before sending emergency disclosure material?
7. Which Nostr relays are defaults, and how are malicious or unavailable relays handled?

## Review cadence

Update this threat model whenever any of these change:

- secret encryption or sharing scheme;
- recipient authorization model;
- disclosure timing/state machine;
- Nostr or other external delivery channel;
- authentication provider;
- database schema for secret material;
- backup, logging, or deletion policy;
- production deployment topology.
