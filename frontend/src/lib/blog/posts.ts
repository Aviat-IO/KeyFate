import type { BlogPost } from "./types"

export const blogPosts: BlogPost[] = [
  {
    slug: "what-is-a-dead-mans-switch",
    title: "What Is a Dead Man's Switch? A Complete Guide",
    description:
      "Learn what a dead man's switch is, how it works, and why cryptocurrency holders, journalists, and anyone with sensitive digital assets should consider using one.",
    publishedAt: "2025-01-15",
    author: "KeyFate Team",
    category: "Education",
    tags: ["dead mans switch", "digital security", "cryptocurrency", "estate planning"],
    readingTime: "6 min read",
    featured: true,
    content: `
## What Is a Dead Man's Switch?

A dead man's switch triggers an action when the person controlling it stops responding. The name comes from railroad engineering: train operators held a lever that kept the brakes off. Let go—because you passed out, had a heart attack, or fell—and the brakes engaged automatically. No decision required. The absence of action *was* the trigger.

The same principle now protects digital secrets. You store encrypted information, check in on a schedule, and designate recipients. Keep checking in and nothing happens. Stop checking in—because of death, imprisonment, incapacity, or anything else—and the system delivers your information to the people you chose.

## How It Works

You encrypt sensitive information: passwords, cryptocurrency seed phrases, legal documents, messages. You set a check-in schedule—daily, weekly, monthly. You pick recipients.

The system sends reminders when a check-in is due. Miss the check-in and the grace period starts. Miss the grace period too, and your encrypted information goes out. The process is irreversible by design.

During your lifetime, nobody has access. Not the service, not the recipients, not anyone. After the trigger, the right people get what they need.

## Who Needs One?

### Cryptocurrency Holders

Private keys and seed phrases are bearer instruments. Lose them and the coins are gone—no recovery process, no customer service, no court order that helps. An estimated 3.7 million Bitcoin are already permanently inaccessible, much of it belonging to people who died without sharing access.

A dead man's switch delivers your recovery information to your heirs when it's actually needed, without exposing it while you're alive.

### Journalists and Activists

If you hold information that powerful people want suppressed, a dead man's switch is insurance. Silence the journalist, trigger the release. The switch's existence alone acts as a deterrent—anyone considering retaliation knows the information comes out regardless.

### Everyone With a Digital Life

Your email, bank accounts, social media, subscriptions, cloud storage, password manager—none of it transfers automatically when you die. Wills become public record and take months to execute. A dead man's switch delivers credentials privately and immediately to the people who need them.

## What to Look For

**Zero-knowledge architecture.** The service should be structurally unable to read your data. Not "we promise we won't look"—rather, the system is built so decryption without your keys is mathematically impossible.

**Threshold cryptography.** KeyFate splits your secret into shares using Shamir's Secret Sharing. No single share—including the one KeyFate stores—reveals anything about the original. A server breach yields encrypted fragments that are individually useless.

**Censorship-resistant delivery.** KeyFate publishes encrypted shares to Nostr relays, a decentralized network with no single point of failure. If KeyFate disappears, the shares are still out there on independent relays, retrievable by your recipients.

**Bitcoin timelocks.** For the highest level of trustlessness, KeyFate can lock the decryption key behind a Bitcoin CSV (CheckSequenceVerify) timelock. The key becomes spendable—and thus recoverable—only after a specified number of blocks, with no human in the loop.
    `.trim(),
  },
  {
    slug: "securing-cryptocurrency-inheritance",
    title: "How to Secure Your Cryptocurrency for Inheritance",
    description:
      "Protect your Bitcoin, Ethereum, and other crypto assets for your heirs. Learn the best practices for cryptocurrency estate planning and inheritance.",
    publishedAt: "2025-01-10",
    author: "KeyFate Team",
    category: "Cryptocurrency",
    tags: ["cryptocurrency", "bitcoin", "inheritance", "estate planning", "private keys"],
    readingTime: "8 min read",
    content: `
## The Problem

Roughly 3.7 million Bitcoin are permanently inaccessible. Forgotten passwords, lost hard drives, dead holders who never shared keys. Hundreds of billions of dollars, visible on the blockchain, owned by no one.

This isn't like a frozen bank account. There's no recovery form. No customer service. No court order that unlocks a private key. If you hold the only copy, your crypto dies with you.

## Why the Obvious Solutions Don't Work

**Safe deposit boxes.** They get sealed during probate—sometimes for months. Your heirs can't access the keys when they need them. And anyone at the bank with access to the box could copy your seed phrase before your family even knows you're gone.

**Writing keys into a will.** Wills become public record after death. Your 24-word seed phrase, entered into court records, is visible to anyone who bothers to look.

**Handing keys to family.** Now your spouse has immediate access to your funds. Relationships change. Devices get hacked. People make mistakes. Premature access is a security failure, even if nothing bad happens.

Each approach trades one risk for another. None solves the core tension: your keys need to stay private while you're alive and become available after you're gone.

## Threshold Cryptography

Shamir's Secret Sharing resolves this tension mathematically. Your seed phrase gets split into shares—say, three of them. Each share alone contains zero information about the original. Not partial information. *Zero.* This is provable, not just claimed.

Set a threshold of 2-of-3. Give one share to your spouse. Store one with KeyFate, encrypted and released only when you miss check-ins. Keep one yourself as backup.

If something happens to you: your spouse's share plus KeyFate's released share reconstructs the seed. But neither party alone can do anything. KeyFate can't access your crypto. Your spouse can't access your crypto. A complete server breach reveals one encrypted share—useless by itself.

## The Censorship-Resistant Layer

KeyFate goes further than just splitting and storing. Encrypted shares are published to Nostr relays—a decentralized network of independent servers with no central point of failure. If KeyFate disappears tomorrow, your shares persist on those relays, retrievable by your recipients using their Nostr keys.

For the decryption key itself, you can use a Bitcoin CSV timelock. The key is locked in a Bitcoin transaction that becomes spendable only after a specified number of blocks (~388 days maximum). When the timelock expires, the key is published on-chain via OP_RETURN. No human decision needed. No trusted party required. The Bitcoin network itself enforces the timing.

This means your crypto inheritance plan doesn't depend on any single company, server, or jurisdiction staying operational.

## What to Actually Do

**Inventory your holdings.** Every wallet, every exchange account, every seed phrase. Note approximate values and where each asset lives.

**Write recovery instructions for non-technical people.** Your heirs may never have used a hardware wallet. Explain what they're receiving, what software to download, and what the recovery steps look like. Warn them about scams—crypto attracts fraud.

**Test the process.** Reconstruct your seed from shares. Walk through recovery on a fresh device. If anything confuses you, it'll be worse for your heirs under stress.

**Update regularly.** New wallets, changed holdings, different family circumstances. Review at least annually.
    `.trim(),
  },
  {
    slug: "shamirs-secret-sharing-explained",
    title: "Shamir's Secret Sharing: The Math Behind Secure Key Splitting",
    description:
      "Understand how Shamir's Secret Sharing algorithm works to split secrets securely. Learn why this cryptographic technique is ideal for protecting cryptocurrency keys and sensitive data.",
    publishedAt: "2025-01-05",
    author: "KeyFate Team",
    category: "Technology",
    tags: ["cryptography", "shamir secret sharing", "security", "mathematics"],
    readingTime: "7 min read",
    content: `
## What Is Shamir's Secret Sharing?

Adi Shamir published the algorithm in 1979. (He's the "S" in RSA.) The idea: split a secret into multiple shares where any *threshold* number of shares reconstructs the original, but fewer shares reveal nothing. Not partial information—literally zero bits of knowledge about the secret.

This is different from cutting a document into pieces, where each piece shows a fragment. With Shamir's scheme, holding one share is mathematically equivalent to holding nothing. You can't get "close" to the secret. You either have enough shares or you have zero information.

## The Intuition

Think about points on a graph.

One point doesn't define a line—infinite lines pass through any single point. Two points define exactly one line. If the secret is the y-intercept of that line, one point tells you nothing about where the line crosses the y-axis. Two points tell you everything.

That's a 2-of-n scheme. For 3-of-n, use a parabola instead of a line—three points pin it down, two don't. For k-of-n, use a degree-(k-1) polynomial. The secret is always the y-intercept.

Shamir's trick: generate a random polynomial of the right degree with your secret as the constant term, then hand out points on that curve as shares. The randomness means each share looks arbitrary. Below the threshold, every possible secret is equally consistent with the shares you hold.

## Why This Beats Simple Splitting

People sometimes split a password in half—give "CorrectHorse" to one person and "BatteryStaple" to another. This is much weaker than it seems.

Each half leaks partial information. "CorrectHorse" dramatically narrows the search space. And if either half is lost, the password is unrecoverable.

With Shamir's shares, losing one share of a 2-of-3 setup still leaves two shares—enough to reconstruct. Stealing one share gets you nothing. And you're not locked into a fixed split—you can create 2-of-3, 3-of-5, 4-of-7, whatever fits your trust model.

## How KeyFate Uses It

When you store a secret with KeyFate, the splitting happens in your browser before anything leaves your device:

1. Your secret is encoded as the constant term of a random polynomial
2. Shares are generated as points on that polynomial
3. Each share is then encrypted with ChaCha20-Poly1305
4. Encrypted shares are distributed: one to KeyFate's server, others to your recipients via Nostr relays

KeyFate holds one encrypted share. Your recipients each hold one. No single party has enough to reconstruct—not KeyFate, not any individual recipient, not an attacker who compromises the server.

When the dead man's switch triggers, shares are released. Recipients combine the threshold number and recover the secret. The math guarantees correctness—if the shares are valid, reconstruction is exact.

## Choosing a Threshold

**2-of-3** works for most personal use. You, your spouse, and KeyFate each hold a share. Any two reconstruct. One share can be lost without consequence. This is what we recommend for individual crypto holders and estate planning.

**3-of-5** adds redundancy for higher-value scenarios. You can lose two shares and still recover. Useful when shares are geographically distributed or held by people who might become unreachable.

Higher thresholds make sense for organizations or extremely high-value assets where you want multiple parties to actively collaborate before reconstruction happens.

## Practical Advice

Store shares separately. Two shares in the same location defeats the purpose.

Test reconstruction before you depend on it. Generate your shares, combine the threshold number, verify the original comes back. Do this while you still have access to everything.

Label shares clearly but don't label them with what they protect. "Share 2 of 3 — contact [trusted person] for additional shares" is useful. "Share for Bitcoin wallet containing 50 BTC" is dangerous.

Update when circumstances change—new holdings, different family situation, changed trust relationships. Shamir's scheme is cheap to redo.
    `.trim(),
  },
  {
    slug: "digital-estate-planning-checklist",
    title: "Digital Estate Planning Checklist: What to Include",
    description:
      "A comprehensive checklist for digital estate planning. Ensure your passwords, accounts, cryptocurrency, and digital assets are accessible to your heirs.",
    publishedAt: "2024-12-20",
    author: "KeyFate Team",
    category: "Estate Planning",
    tags: ["estate planning", "digital assets", "passwords", "checklist"],
    readingTime: "5 min read",
    content: `
## Why This Matters

The average person has over 100 online accounts. When you die, exactly zero of them transfer automatically to your heirs. Subscriptions keep charging. Photos stay locked behind passwords nobody knows. Cryptocurrency vanishes. Email—the master key to resetting every other account—sits behind a login your family can't crack.

This is the checklist you need to build before any of that happens.

## The Inventory

### Financial Accounts

Online banking, investment accounts (Fidelity, Vanguard, Schwab), retirement portals, credit card logins, payment apps (PayPal, Venmo, Zelle). Your heirs need these to understand what exists and settle your estate.

### Cryptocurrency

Exchange accounts with login credentials. Self-custody wallet seed phrases (12 or 24 words). Hardware wallet PINs and physical locations. DeFi positions and NFT holdings.

Crypto deserves special attention: unlike bank accounts, there's no legal process that recovers a lost private key. Document everything, and use <a href="/blog/shamirs-secret-sharing-explained">Shamir's Secret Sharing</a> to protect seed phrases.

### Email

Email is the skeleton key. Password recovery for almost every service routes through it. Document your primary and secondary email credentials, and any app-specific passwords for services like Gmail.

### Social Media

Facebook, Instagram, Twitter/X, LinkedIn, YouTube. Configure legacy settings now (Facebook Legacy Contact, Google Inactive Account Manager). Note which accounts should be memorialized, deleted, or downloaded.

### Cloud Storage

Google Drive, iCloud, Dropbox, OneDrive, photo services. Some of this is irreplaceable—family photos, personal writing, legal documents. Make sure someone can get in.

### Subscriptions

Streaming, software, domains, hosting, gym memberships, meal kits. These keep billing after death. Your heirs need a list so they can cancel.

### The Master Keys

Your password manager master password is probably your single most important credential. Also document 2FA backup codes, recovery keys, encrypted file passwords, and the physical location of any hardware security keys.

### Devices

Phone and tablet passcodes. Computer login passwords. Smart home admin credentials. Router password. Security camera access.

## How to Store It

Don't put credentials in a Word doc on your desktop. Don't email them to yourself. Don't write them in your will (it becomes public record).

Use a dead man's switch. Store everything encrypted, designate recipients, set your check-in schedule. The information stays locked while you're alive and releases automatically when needed. KeyFate encrypts on your device before anything reaches the server, splits secrets with Shamir's Secret Sharing, and distributes shares via Nostr relays for censorship-resistant delivery.

Review every 6-12 months. Accounts change. Passwords get updated. New services appear. An outdated inventory is worse than useless—it gives false confidence.
    `.trim(),
  },
  {
    slug: "journalist-source-protection",
    title: "Dead Man's Switch for Journalists: Protecting Sources and Stories",
    description:
      "How investigative journalists use dead man's switches to protect their sources, unpublished stories, and ensure information survives if they're compromised.",
    publishedAt: "2024-12-15",
    author: "KeyFate Team",
    category: "Security",
    tags: ["journalism", "source protection", "security", "whistleblowers"],
    readingTime: "6 min read",
    content: `
## The Problem

You're holding information that someone powerful wants buried. You need to protect it *and* ensure it comes out if you can't publish it yourself. These two requirements pull in opposite directions: secrecy demands keeping information locked down; resilience demands distributing it.

A dead man's switch resolves the contradiction. Information stays encrypted and inaccessible while you're working. If you're silenced, it releases automatically. The switch's very existence serves as a deterrent—taking action against you triggers exactly the outcome the adversary wants to prevent.

## The Insurance Policy Effect

This is the core value for journalists. Once your adversary knows (or suspects) a dead man's switch exists, the calculus changes. Silence the journalist, and the encrypted dossier goes to five newsrooms simultaneously. There's no person to pressure, no server to seize, no decision to intercept. The release is mechanical.

KeyFate strengthens this by distributing encrypted shares across Nostr relays—a decentralized network of independent servers. There's no single company to compel, no jurisdiction that covers every relay, no takedown request that works. If KeyFate itself were shut down, the shares already published to relays remain retrievable.

## What to Store

**For source protection:** encrypted communication protocols, safety verification procedures, contact information for press freedom legal teams, instructions for trusted colleagues about verifying your status.

**For story continuation:** current investigation status, evidence locations, key documents (encrypted), publication-ready drafts if they exist, contact information for sources who've consented to be contacted by your colleagues.

**For personal safety:** emergency contacts, legal representation details, relevant embassy information for international assignments.

Never store source identities in plaintext anywhere. Encrypt them separately. Consider whether identifying information should be in the dead man's switch at all, or whether you should store only enough for a colleague to continue the work without exposing the source.

## Check-In Frequency

This matters more for journalists than for most users.

**Daily check-ins** for active dangerous assignments—conflict zones, surveillance-heavy environments, investigations into organized crime.

**Weekly check-ins** for ongoing investigations that don't involve immediate physical risk.

Build in grace periods that account for travel, communication blackouts, and the realities of field work. A 24-hour check-in with a 48-hour grace period gives you three days before release—enough to survive a missed connection without triggering a false alarm.

## Choosing Recipients

Multiple recipients, different roles:

- A trusted colleague at your publication who understands the story
- An independent journalist outside your organization
- A press freedom legal team (Reporters Committee, CPJ, RSF)
- A secure document archive as a final backstop

No single recipient should be the only path. Pressure on one person shouldn't be able to stop publication.

## Operational Security

Assume your devices are compromised. Use separate devices for sensitive work. Encrypt communications end-to-end. Don't reuse passwords. Use a password manager with a strong master passphrase stored in its own dead man's switch entry.

For the switch itself, choose a service with zero-knowledge architecture—where the provider structurally cannot read your data. KeyFate encrypts everything on your device with ChaCha20-Poly1305 before it ever reaches a server, and the server only holds one encrypted share of a Shamir split. A complete server seizure yields nothing usable.

## Legal Realities

Shield laws vary by jurisdiction. Some protect against compelled disclosure of sources; most don't explicitly address dead man's switches. Consult a media lawyer. Document your reasoning for configuring the switch—courts are more sympathetic to journalists acting in good faith.

The decentralized delivery via Nostr relays matters here. A court order directed at KeyFate can't recall shares already published to independent relays across multiple jurisdictions.
    `.trim(),
  },
  {
    slug: "bitcoin-inheritance-guide",
    title: "Bitcoin Inheritance: The Complete Guide for Hodlers",
    description:
      "A comprehensive guide to Bitcoin inheritance planning. Learn how to ensure your BTC passes safely to your heirs without exposing your private keys.",
    publishedAt: "2024-12-10",
    author: "KeyFate Team",
    category: "Cryptocurrency",
    tags: ["bitcoin", "inheritance", "hodl", "private keys", "cold storage"],
    readingTime: "9 min read",
    content: `
## The Self-Custody Paradox

Bitcoin's killer feature—no intermediary can freeze, seize, or deny access to your coins—becomes a lethal bug when you die. The network doesn't know you're dead. It doesn't care. It verifies cryptographic signatures, not death certificates.

No keys, no coins. This is absolute. An estimated 3.7 million BTC are permanently inaccessible. Hundreds of billions of dollars, sitting on-chain, owned by nobody.

Your seed phrase needs to stay secret while you're alive (to prevent theft) and become available after you're gone (to enable inheritance). Every approach to Bitcoin inheritance is really about resolving this tension.

## The Strategies

### Shamir's Secret Sharing + Dead Man's Switch

This is what we recommend for most holders. Your 24-word seed phrase is split into shares using <a href="/blog/shamirs-secret-sharing-explained">Shamir's Secret Sharing</a>. Each share alone reveals nothing—not partial information, literally zero knowledge about the seed.

A 2-of-3 setup: your spouse holds one share, KeyFate holds one (encrypted, released when you miss check-ins), you keep a backup. Any two shares reconstruct the seed. No single party can access your Bitcoin.

KeyFate adds two layers beyond basic secret sharing:

**Nostr relay distribution.** Encrypted shares are published to a decentralized network of relays. If KeyFate shuts down, the shares persist. Your recipients retrieve them using their Nostr keys.

**Bitcoin CSV timelocks.** The encryption key can be locked behind a Bitcoin transaction that becomes spendable only after a set number of blocks (~388 days maximum). When the timelock expires, the key is published on-chain via OP_RETURN. No human judgment required. The Bitcoin network enforces the timing.

### Multisig Wallets

The wallet itself requires multiple keys to spend—2-of-3, 3-of-5, etc. You hold one key, your spouse holds another, a backup sits with an attorney.

This works but demands technical sophistication from everyone involved. Your heirs need to understand multisig coordination. The wallet software must still exist and be compatible years later. Setup and ongoing management are more complex than secret sharing.

For most families, multisig is overkill. It solves a different problem (protecting against unauthorized spending right now) rather than the inheritance problem (delivering access after death).

### Paper Backup

Write your seed phrase on paper, put it in a safe. Simple, and dangerously brittle. Anyone who finds the paper has your Bitcoin. The safe deposit box gets sealed during probate. Paper burns, floods, and fades. A single point of failure for what might be your most valuable asset.

## Implementation

**1. Inventory your holdings.** Every wallet (hardware, software, exchange), every seed phrase. Note approximate values.

**2. Write instructions for non-technical people.** "You will receive a set of Shamir shares. Here's how to combine them. Here's what wallet software to download. Here's what the recovery process looks like." Warn about scams—crypto attracts fraud targeting bereaved families.

**3. Set up the dead man's switch.** <a href="/sign-in">Create a KeyFate account</a>, store your seed phrase, configure your check-in schedule and recipients. The splitting and encryption happen in your browser.

**4. Test recovery.** Combine your threshold shares. Verify the seed phrase reconstructs correctly. Walk through the full recovery on a fresh device. If anything confuses you, simplify it.

**5. Maintain it.** New wallets, changed holdings, different family circumstances—review annually and after major life events.

## Common Mistakes

**Storing seeds in plaintext.** Email, cloud storage, text files, unencrypted safe deposit boxes. Don't.

**Over-engineering.** Complex setups that you understand but your spouse won't. Your heirs may have zero crypto experience. The recovery process should be followable by someone who's never used a wallet.

**Never testing.** An untested backup is not a backup. If you haven't verified reconstruction works, you don't know that it does.

**Not updating.** Holdings change. Relationships change. Storage locations get compromised. A plan from three years ago may not reflect your current situation.
    `.trim(),
  },
  {
    slug: "password-manager-master-password-protection",
    title: "Protecting Your Password Manager Master Password",
    description:
      "Your password manager master password is the key to your entire digital life. Learn how to protect it while ensuring trusted access when needed.",
    publishedAt: "2024-12-05",
    author: "KeyFate Team",
    category: "Security",
    tags: ["password manager", "master password", "security", "1password", "bitwarden"],
    readingTime: "6 min read",
    content: `
## The Single Point of Failure

Password managers solve the "too many passwords" problem. You memorize one master password; the manager handles the rest. Security experts recommend this, and they're right.

But your master password is now the key to everything. Email. Banking. Social media. Cloud storage. Work accounts. Every credential you've accumulated over years of digital life, behind a single door. Forget the master password and you're locked out. Die without sharing it and your family is locked out—of everything, simultaneously.

## What's Actually at Stake

Your email credentials alone are devastating to lose. Password recovery for almost every other service routes through email. Lose email access and the cascade begins—every account that depends on "forgot password" becomes unreachable.

Behind the password manager you likely also have: financial account logins, 2FA recovery codes, secure notes with information stored nowhere else, and credentials for accounts your family doesn't even know exist.

## The Approach That Works

Split your master password using Shamir's Secret Sharing. KeyFate handles this automatically:

1. You enter your master password as a secret
2. It's split into shares on your device (nothing leaves your browser in plaintext)
3. Shares are distributed—one encrypted on KeyFate's server, one to your designated recipient via Nostr relays
4. If you miss check-ins, shares are released and your recipient can reconstruct the password

No single party can access your vault. KeyFate can't. Your spouse can't. A complete server breach yields one encrypted share—useless alone.

## Password Manager Specifics

**1Password:** You need both the master password *and* the 34-character Secret Key. The Emergency Kit PDF contains both. Store it encrypted in your dead man's switch. Family accounts have organizer recovery; individual accounts don't.

**Bitwarden:** Offers built-in Emergency Access with a configurable waiting period. Useful as a backup, but it's vault export rather than live access. Store the master password and any 2FA recovery codes in your switch.

**Dashlane:** No master password recovery at all. If you don't plan ahead, access is permanently lost. Non-negotiable to have a dead man's switch for Dashlane users.

**LastPass:** Has Emergency Access. After their 2022 breach, understand what's stored where and how it's encrypted before relying on their infrastructure alone.

## Practical Details

**Use a passphrase, not a password.** "correct-horse-battery-staple-mountain" is both stronger and easier to write down accurately than "P@ssw0rd123!". Length beats complexity.

**Document the full process.** Your heirs need: where to download the password manager app, which email address is the login, whether there's a Secret Key or 2FA, and what to do if something doesn't work.

**Test every 6-12 months.** Verify the master password is still current. Confirm recovery methods still work. Make sure your recipient knows what they'll receive.

**Plan for 2FA.** If your password manager has two-factor authentication enabled (it should), the recovery codes need to be in your dead man's switch too. Otherwise your heirs hit a second locked door after cracking the first.
    `.trim(),
  },
  {
    slug: "check-in-schedule-best-practices",
    title: "How to Choose the Right Check-In Schedule",
    description:
      "Selecting the right check-in frequency for your dead man's switch is crucial. Learn how to balance security with convenience for your lifestyle.",
    publishedAt: "2024-11-28",
    author: "KeyFate Team",
    category: "Education",
    tags: ["check-in", "dead mans switch", "security", "best practices"],
    readingTime: "5 min read",
    content: `
## The Tradeoff

Check-in frequency controls two things: how quickly your secrets release if something happens to you, and how much mental overhead you tolerate in daily life. Too short and you'll accidentally trigger a release during a camping trip. Too long and your heirs wait months for access they need now.

## Short Intervals (Daily to Weekly)

Fast response when it matters. If you're a journalist in a conflict zone or holding keys to high-value crypto, you want the gap between incapacity and release to be short.

The cost: daily or weekly check-ins become a persistent task. Miss one during a busy week, a hospital stay, or a spotty-connectivity trip, and you're relying on grace periods to prevent a false trigger.

**Best for:** journalists on dangerous assignments, very high-value crypto, situations where hours matter.

## Medium Intervals (Weekly to Monthly)

The right default for most people. A weekly or bi-weekly check-in is easy to build into a routine—Sunday evening, first Monday of the month. Missing one isn't catastrophic because the grace period covers normal life disruptions.

**Best for:** typical crypto holders, password manager protection, general estate planning, business continuity.

## Long Intervals (Monthly to Yearly)

Low maintenance. You check in quarterly or annually, and the system mostly stays out of your way. But the delay before release can be significant—potentially too slow for time-sensitive information.

**Best for:** stable estate documents, backup systems layered behind shorter-interval primary switches, information that isn't time-sensitive.

## Match the Interval to the Secret

You don't need one interval for everything. Use different schedules for different secrets:

- **Daily/weekly:** active investigation materials, high-value crypto keys
- **Weekly/bi-weekly:** password manager master password, primary account credentials
- **Monthly:** general account inventory, subscription lists
- **Quarterly/yearly:** estate planning documents, long-term storage

## Building the Habit

Attach check-ins to existing routines. "Every Sunday when I review my week" or "first of each month when I pay bills" sticks better than an arbitrary reminder.

Set up redundant notifications: calendar event, email from KeyFate, phone alarm. Forgetting is the most common failure mode—make it hard to forget.

Before a vacation or planned absence, check in early. If you'll be unreachable for longer than your interval, either extend the interval temporarily or check in before you go.

## Grace Periods and False Triggers

Missing one check-in doesn't immediately trigger release. KeyFate sends escalating reminders—gentle nudge, then urgent, then final warning. The grace period between missed check-in and actual release gives you a buffer.

If you're worried about false triggers: start with a longer interval and shorten it once you've built the habit. A monthly check-in with a 2-week grace period gives you 6 weeks of silence before release—plenty of margin while you're getting comfortable.
    `.trim(),
  },
  {
    slug: "two-factor-authentication-recovery",
    title: "Two-Factor Authentication Recovery: Planning for the Worst",
    description:
      "2FA protects your accounts, but what happens when you lose access? Learn how to plan 2FA recovery for yourself and your heirs.",
    publishedAt: "2024-11-20",
    author: "KeyFate Team",
    category: "Security",
    tags: ["2fa", "two-factor authentication", "recovery", "security", "backup codes"],
    readingTime: "7 min read",
    content: `
## The Problem You Created by Being Secure

Two-factor authentication is excellent security. Something you know (password) plus something you have (phone, security key). Remote attackers who steal your password still can't get in.

But 2FA creates failure modes that didn't exist before. Phone breaks? You're locked out of every account that uses your authenticator app. Die without sharing 2FA access? Your heirs hit a wall that passwords alone can't solve—even if they have every credential you own.

The same lock that keeps attackers out keeps your family out. Planning for this is non-optional.

## The 2FA Types and Their Failure Modes

**Authenticator apps** (Google Authenticator, Authy, Microsoft Authenticator) generate time-based codes on your device. Lose the device, lose the codes. Google Authenticator doesn't sync by default—this is a common disaster.

**SMS codes** are tied to your phone number, not your device. SIM swaps can steal them. Phone number changes break them. Less secure than app-based 2FA, but at least they survive a broken phone if you keep the number active.

**Hardware keys** (YubiKey, Google Titan) require physical possession. Very secure. Also very lost-able. And your heirs need to know where it is and what it's for.

**Backup codes** are one-time recovery codes generated when you set up 2FA. Most people save them once and forget where. Or use them all and don't generate new ones.

## What to Do

**Audit your 2FA accounts.** Every service where you've enabled 2FA: email, banking, social media, crypto exchanges, password manager. Note the 2FA type and what recovery options exist.

**Save backup codes in three places.** Your password manager, an encrypted document, and your dead man's switch. Never in plaintext files, email drafts, or sticky notes.

**Use Authy over Google Authenticator.** Authy syncs across devices with encrypted cloud backup. Losing your phone doesn't mean losing everything. The tradeoff: you must secure your Authy backup password. Put it in your dead man's switch.

**Configure multiple recovery methods.** Recovery email, recovery phone number, trusted contacts. At least two paths into every important account. One failure shouldn't cascade.

**Document the full picture for your heirs.** They need: account credentials + backup codes + access to recovery email/phone + your phone's PIN (to access the authenticator app) + hardware key locations. Store all of this encrypted in your dead man's switch.

## Service-Specific Notes

**Google:** 10 backup codes. Print them. Set up Inactive Account Manager to auto-share data after inactivity. Recovery phone + recovery email as backups.

**Apple ID:** Uses trusted phone numbers + optional recovery key. Set up Account Recovery Contact (iOS 15+) for family access.

**Crypto exchanges:** Policies vary wildly. Document the exact recovery process, what documentation your heirs need, and customer support contact info. This is worth an hour of research per exchange—the stakes are high.

## The Emergency Kit

Build an encrypted document with everything someone needs to navigate your 2FA:

For each account: name, URL, login email, password manager reference, 2FA type, backup codes, recovery contacts.

General info: password manager master password, authenticator app backup password, phone PIN, computer passwords, hardware key locations.

Store this in your dead man's switch. KeyFate encrypts it on your device before it ever leaves your browser, splits it into shares, and delivers the shares to your recipients when the switch triggers. Your heirs get everything they need in one package.
    `.trim(),
  },
  {
    slug: "zero-knowledge-security-explained",
    title: "Zero-Knowledge Security: Why It Matters for Your Secrets",
    description:
      "Understand zero-knowledge architecture and why it's essential for protecting sensitive information. Learn how KeyFate ensures even we can't access your secrets.",
    publishedAt: "2024-11-15",
    author: "KeyFate Team",
    category: "Technology",
    tags: ["zero knowledge", "encryption", "security", "privacy", "architecture"],
    readingTime: "6 min read",
    content: `
## What It Actually Means

"Zero-knowledge" means the service provider cannot access your data. Not "won't"—*can't*. The system is built so that decryption without your keys is mathematically impossible.

This is different from a privacy policy that says "we don't look at your data." Policies change. Employees get bribed. Companies get acquired. Court orders compel disclosure. A policy is a promise from people. Zero-knowledge is a constraint from mathematics. Mathematics doesn't negotiate.

## How Traditional Security Fails

In a standard setup: you send data to a service, the service encrypts it, the service holds the encryption key. Your secret is now protected by their operational security, their employee integrity, their resistance to legal pressure, and their continued existence as the same company with the same policies.

Data breaches expose both encrypted data and keys. Insider threats bypass access controls. Government orders compel decryption. Acquisitions change everything about how your data gets handled.

You're trusting people you've never met to protect your most sensitive information indefinitely. This is a bad bet for anything that truly matters.

## How Zero-Knowledge Works

**Client-side encryption.** Your data is encrypted in your browser with a key you control. The encrypted result—ciphertext—travels to the server. The server stores ciphertext. At no point does the server see, process, or have the ability to decrypt your plaintext data.

**No key escrow.** The encryption keys never leave your device. There's no "forgot password" that magically restores access. If you lose the key, the data is gone—the same math that protects you from the service protects the data from anyone without the key.

**Threshold splitting.** KeyFate goes further: your secret is split into shares using Shamir's Secret Sharing before encryption. KeyFate stores one encrypted share. Your recipients get others. No single share—including KeyFate's—reveals anything about the original.

## The Dead Man's Switch Challenge

Zero-knowledge and dead man's switches seem contradictory. The switch needs to release your secret when you're not around to authorize it. Doesn't that require the service to have access?

No. KeyFate holds one share of a Shamir split. Recipients hold other shares. The switch triggers the release of KeyFate's share—but that share alone is useless. Only when combined with recipient shares does reconstruction become possible.

KeyFate adds a censorship-resistant layer on top: encrypted shares are published to Nostr relays (a decentralized network of independent servers). Even if KeyFate is compromised, shut down, or legally compelled, the shares on Nostr relays persist and remain retrievable.

For the decryption key, the Bitcoin CSV timelock option removes human trust entirely. The key is locked in a Bitcoin transaction that becomes spendable after a specified block count. When it unlocks, the key is published on-chain. No KeyFate involvement needed.

The result: a zero-knowledge system that releases secrets without any party having unauthorized access at any point in the process.

## The Litmus Test

Ask any service that claims "zero-knowledge" these questions:

- **What happens if I forget my password?** If they can help you recover without your key material, they have your keys.
- **Can customer support access my data?** If yes, it's not zero-knowledge.
- **What would you provide if served with a court order?** If the answer is anything other than "ciphertext we can't decrypt," they have access.
- **Can you read my data if your servers are fully compromised?** If the breach exposes usable data, the architecture isn't zero-knowledge.

Many services marketed as "encrypted" fail these tests. End-to-end encryption is necessary but not sufficient—if the provider holds key escrow or recovery mechanisms, they have a copy of your keys.

## The Tradeoff

Zero-knowledge puts responsibility on you. Lost keys mean lost data. There's no safety net. This is the price of mathematical guarantees. KeyFate mitigates this through Shamir's threshold scheme (losing one share doesn't lose the secret) and decentralized distribution via Nostr (shares survive even if KeyFate doesn't). But ultimately, your secrets are only as safe as your management of the shares and key material.

That tradeoff—responsibility for actual security—is better than the alternative: trusting someone else's promise and hoping it holds.
    `.trim(),
  },
  {
    slug: "digital-will-vs-dead-mans-switch",
    title: "Digital Will vs Dead Man's Switch: Key Differences Explained",
    description:
      "Understand the differences between a digital will and a dead man's switch. Learn which solution is right for your digital estate planning needs.",
    publishedAt: "2024-11-10",
    author: "KeyFate Team",
    category: "Estate Planning",
    tags: ["digital will", "dead mans switch", "estate planning", "comparison"],
    readingTime: "6 min read",
    content: `
## Different Tools for Different Assets

A digital will is a legal document. It goes through probate, becomes public record, takes weeks to months, and gives your executor court authority to compel companies to comply.

A dead man's switch is an automated release mechanism. It's triggered by missed check-ins, delivers encrypted information to designated recipients, operates outside the legal system, and is completely private.

Most people with significant digital assets need both.

## Where a Digital Will Works

Traditional accounts with established death policies: email, social media, banking, investment accounts. Companies recognize executor authority backed by court orders. The legal framework handles transfer of accounts that belong to centralized services.

A digital will also serves as the official record of your wishes—which accounts to memorialize, which to delete, who handles what.

## Where a Digital Will Fails

**Cryptocurrency.** Your 24-word seed phrase in a document that becomes public record during probate is catastrophically bad security. Anyone who accesses court filings can see it. Attorneys handling the estate can see it. And the probate timeline—weeks to months—is far too slow for volatile markets.

**Passwords.** Same public record problem. Your password manager master password in a probate filing is a gift to identity thieves.

**Time-sensitive information.** Probate moves at legal speed, not crisis speed. If your family needs access now, "the court will process this in 6-8 weeks" doesn't help.

## Where a Dead Man's Switch Works

Anything that needs to stay private and arrive fast. Cryptocurrency seed phrases (protected with Shamir's Secret Sharing, so no single party has the whole key). Password manager access. Account credentials. Business continuity information. Personal messages.

KeyFate's implementation adds censorship resistance: encrypted shares distributed via Nostr relays survive even if KeyFate itself is unavailable. Bitcoin CSV timelocks can release decryption keys automatically, with no human in the loop.

## Where a Dead Man's Switch Falls Short

No legal authority. If your heirs need a court order to compel a company to hand over an account, a dead man's switch can't provide that. It delivers information, not legal standing.

Requires maintenance—you have to keep checking in. An abandoned switch eventually triggers. (This is a feature in the incapacity case, but it means the system needs active engagement.)

## Using Both Together

Your digital will handles the legal framework:
- Names a digital executor
- Lists accounts and assets
- References the existence of your dead man's switch
- Provides general instructions

Your dead man's switch handles the sensitive material:
- Crypto seed phrases (Shamir-split, encrypted)
- Password manager master password
- 2FA backup codes
- Detailed recovery instructions
- Personal messages to recipients

Your will might say: "I maintain a dead man's switch with KeyFate. Recipients [names] will receive access to my cryptocurrency and credentials. My executor should coordinate with these recipients for complete estate settlement."

The will provides authority. The switch provides access. Together they cover everything.
    `.trim(),
  },
  {
    slug: "cold-storage-inheritance-planning",
    title: "Cold Storage Inheritance Planning: Securing Hardware Wallets for Heirs",
    description:
      "Learn how to plan inheritance for Bitcoin stored in cold storage. Ensure your hardware wallet holdings pass safely to your family.",
    publishedAt: "2024-11-05",
    author: "KeyFate Team",
    category: "Cryptocurrency",
    tags: ["cold storage", "hardware wallet", "ledger", "trezor", "inheritance"],
    readingTime: "8 min read",
    content: `
## The Problem with Cold Storage Inheritance

Cold storage is the gold standard for protecting crypto from online threats. Hardware wallets keep your keys offline, air-gapped from the internet. Excellent security while you're alive.

Terrible for inheritance. The device can be lost, broken, or destroyed. The PIN dies with you if you never shared it. The seed phrase—the actual key to everything—has to survive decades and reach the right person at the right time.

## What Your Heirs Actually Need

With the hardware wallet: the physical device, the PIN, and enough knowledge to use it.

Without the hardware wallet: the 24-word seed phrase and a compatible wallet app. The seed phrase is what matters. With it, everything is recoverable from any device. Without it, even having the hardware wallet is useless if the PIN is unknown.

## Protecting the Seed Phrase

### Shamir's Secret Sharing (Recommended)

Split the seed phrase into shares. 2-of-3 is the most common setup: one share with your spouse, one encrypted on KeyFate's server (released when you miss check-ins), one as your backup.

Each share individually reveals zero information about the seed. Any two reconstruct it. KeyFate publishes encrypted shares to Nostr relays for censorship-resistant delivery—if KeyFate disappears, the shares remain retrievable from independent relay servers.

### Metal Backup

Stamp seed words into steel or titanium plates. Survives fire and flood. Store in a home safe or bank vault. The problem: it's a single point of failure, and anyone who finds it has your crypto. Consider this as one component alongside a Shamir setup, not a standalone solution.

## Device-Specific Notes

**Ledger:** Document the device location, PIN, 24-word seed, and any passphrase (25th word). Ledger offers their own "Ledger Recovery" service—it's controversial because it sends key material to third parties. Shamir's Secret Sharing through KeyFate keeps you in control without trusting Ledger's partners.

**Trezor:** Model T and newer support native Shamir backup (SLIP-39) on-device during setup. If your Trezor already generated Shamir shares, document how many exist and where each one is stored. Make sure your dead man's switch includes the locations and instructions for combining them.

**Coldcard:** Has dangerous features like Brick Me PIN (destroys the device) and duress wallets. Document these explicitly so your heirs don't accidentally destroy the device. Clear warnings, in large text, at the top of your instructions.

## Writing Instructions

Write for someone who has never touched a hardware wallet. Your heirs may be smart, capable people who have zero cryptocurrency experience.

Include: what crypto you hold and approximate value, which devices you use and where they are, PINs, step-by-step usage instructions, seed phrase backup location (or Shamir share details), wallet software to download and where to get it safely, and—critically—scam warnings. Crypto attracts fraud targeting bereaved families. "Never enter seed phrases on websites. Be suspicious of anyone offering to help who wasn't designated in advance."

## What Goes in the Dead Man's Switch

- Seed phrase access (Shamir shares with instructions for obtaining additional shares)
- Hardware wallet details: device location, PIN, passphrase if applicable
- Recovery guide for accessing funds without the hardware wallet
- Approximate values and holdings summary
- Contact information for any designated helpers
- Security warnings

## Testing

Gather your threshold shares. Combine them. Verify the seed phrase comes back correctly. Recover to a new wallet on a fresh device and confirm balances appear.

Have someone else read your instructions and explain the steps back to you. If they're confused, your heirs will be worse off—they'll be confused and grieving.

Update annually or after any significant change in holdings, devices, or family situation.
    `.trim(),
  },
  {
    slug: "subscription-accounts-after-death",
    title: "Managing Subscription Accounts After Death: A Guide for Families",
    description:
      "When someone passes away, their subscriptions keep charging. Learn how to identify, access, and cancel digital subscriptions during estate settlement.",
    publishedAt: "2024-10-30",
    author: "KeyFate Team",
    category: "Estate Planning",
    tags: ["subscriptions", "estate planning", "digital accounts", "family"],
    readingTime: "5 min read",
    content: `
## Subscriptions Don't Know You're Dead

The average person carries 12+ paid subscriptions. Netflix, Spotify, Adobe, gym memberships, cloud storage, meal kits, news sites, SaaS tools. When you die, they keep charging. Month after month, the credit card bills pile up while your family doesn't even know which services exist, let alone how to cancel them.

This is a solvable problem, but only if you plan for it.

## Where to Look

**Streaming and media:** Netflix, Hulu, Disney+, Spotify, Audible, YouTube Premium, Apple TV+.

**Software:** Microsoft 365, Adobe Creative Cloud, password managers, cloud storage (Dropbox, Google One, iCloud+).

**Health and fitness:** Gym memberships, Peloton, meditation apps (Headspace, Calm), health trackers.

**News:** Newspaper subscriptions, Substack newsletters, magazine services.

**Home:** Ring, Nest, smart home services, meal kits, pet supply services.

**Professional:** LinkedIn Premium, domains, hosting, professional organizations.

**App store:** Check Apple Settings > Apple ID > Subscriptions, and Google Play Store > Subscriptions. People forget about these constantly.

## Finding the Ones You Forgot

Pull credit card and bank statements for the last 3 months. Look for recurring charges. Search email for "subscription," "renewal," "billing," and "receipt." Check the password manager—every login is a potential subscription.

## Canceling Without Access

Death certificate + proof of relationship gets you surprisingly far. Most companies will cancel when presented with these documents plus account identification (email or name on account).

When official channels fail: cancel the credit card being charged. Dispute post-death charges with the card issuer. Banks can block recurring charges from specific merchants.

Apple, Google, and Amazon all have documented processes for death-related account actions. They're slow, but they work.

## The Prevention Plan

Maintain a subscription inventory. For each: service name, cost, billing frequency, payment method, how to cancel. Store it in your dead man's switch along with your password manager credentials and email access.

Include notes on what to keep (shared family accounts, cloud storage with irreplaceable data), what to cancel immediately (anything purely personal), and what's hard to cancel (gym memberships, services without online cancellation).

Update the list when you add or remove subscriptions. A stale inventory is better than nothing, but a current one is better.
    `.trim(),
  },
  {
    slug: "social-media-accounts-after-death",
    title: "Social Media After Death: Memorialize, Delete, or Transfer?",
    description:
      "What happens to social media accounts when someone dies? Learn about memorialization, deletion, and account transfer options for Facebook, Instagram, Twitter, and more.",
    publishedAt: "2024-10-25",
    author: "KeyFate Team",
    category: "Estate Planning",
    tags: ["social media", "facebook", "instagram", "digital legacy", "memorialization"],
    readingTime: "6 min read",
    content: `
## What Happens to Your Accounts

When you die, your social media accounts keep existing. Friends still tag you in memories. The algorithm still surfaces your old posts. Your profile picture still appears in search results. Nothing happens automatically.

Your family eventually faces a decision: memorialize, delete, or try to take over the account. Each platform handles this differently, and none of it is intuitive to figure out while grieving.

## Platform by Platform

**Facebook / Instagram (Meta).** Most developed options. Accounts can be memorialized ("Remembering" added before the name, content preserved). Accounts can be deleted permanently. Data can be downloaded.

If you designated a Legacy Contact, they can write a pinned tribute post, update profile/cover photos, respond to friend requests, request deletion, and download content. They *cannot* log in, read messages, or change past posts.

Set this up now: Settings > General > Memorialization Settings.

**Twitter/X.** No memorialization. Only deactivation, which leads to permanent deletion after 30 days. Download data before requesting deactivation—once it's gone, it's gone.

**LinkedIn.** Can add "In Loving Memory" banner and remove from search, or close the account entirely. Use their deceased member form.

**YouTube / Google.** Inactive Account Manager (set up at myaccount.google.com) auto-shares data after an inactivity period you configure. Without it, contact YouTube with death certificate for data download or closure.

**TikTok / Pinterest.** Deletion only, no memorialization. Contact with death certificate.

## What to Do Now

**Configure legacy features.** Facebook Legacy Contact, Google Inactive Account Manager. Takes 10 minutes each.

**Decide your preferences.** Which accounts memorialized? Which deleted? Any content to preserve or remove? Write it down.

**Store instructions in your dead man's switch.** List all social media accounts, your wishes for each, credentials where relevant, and who should handle the decisions.

**Download your own data periodically.** Most platforms offer export features. Your family can't download after deletion, and some platforms restrict downloads for non-account-holders.

## For Families

You often don't need passwords. Memorialization, deletion, and data requests go through official platform channels with death certificate and relationship proof.

Don't rush. Friends may want time to post memories and tributes on a memorialized account. Deletion is permanent. Download data first.

There's no universally right answer. Some families find comfort in a preserved profile. Others want clean closure. If the person didn't leave instructions, make the decision together.
    `.trim(),
  },
  {
    slug: "email-access-for-executors",
    title: "Email Access for Executors: Legal and Practical Guide",
    description:
      "Executors often need email access to settle estates. Learn the legal framework, provider policies, and practical steps for accessing a deceased person's email.",
    publishedAt: "2024-10-20",
    author: "KeyFate Team",
    category: "Estate Planning",
    tags: ["email", "executor", "estate planning", "legal", "gmail", "outlook"],
    readingTime: "7 min read",
    content: `
## Why Email Is the First Domino

Email is the skeleton key to a digital estate. Password recovery for almost every service routes through it. Financial statements, subscription confirmations, legal documents, business correspondence—it all lives in the inbox.

For executors, getting into email is often the critical first step. Without it, you're locked out of everything else.

## The Legal Landscape

The Revised Uniform Fiduciary Access to Digital Assets Act (RUFADEA) governs digital asset access in most US states. Priority order: the user's own settings (like "delete on death") come first, then will provisions, then provider terms of service, then state default rules.

Key takeaway: if the deceased configured their account to auto-delete, that usually trumps executor authority. User settings win.

## What Each Provider Will (and Won't) Do

**Gmail / Google.** Best case: Inactive Account Manager was set up, and you get automatic data access after inactivity. Without it: submit Google's deceased user form with death certificate, your ID, and proof of legal authority. Expect weeks to months. They may provide data export but won't give you login access or reset the password.

**Outlook / Microsoft.** No equivalent to Inactive Account Manager. Submit Next of Kin form with death certificate. May provide data on DVD. Takes months. No live access.

**Yahoo.** Will close the account. Will *not* release content to families. Court orders produce inconsistent results. Yahoo is the worst major provider for this.

**iCloud / Apple.** If Digital Legacy was configured: Legacy Contacts get access codes for most iCloud data (3-year window after death). Without it: submit documentation and hope. Data access possible; live account access isn't.

**ProtonMail.** Zero-knowledge encryption means ProtonMail literally cannot access email content. Without the password, emails are permanently inaccessible. This is intentional.

## Practical Steps

**1. Check for pre-planning.** Password manager access, Google/Apple legacy settings, dead man's switch accounts, physical notes, estate documents.

**2. Try password recovery.** Recovery email (might lead to an accessible account), phone number recovery (if you have their phone), security questions. Document your legal authority before attempting access.

**3. Contact the provider.** Certified death certificate, your ID, proof of executor status, specific request (data download, account closure). Be prepared for weeks of waiting, possible denial, and the need for follow-up.

**4. Escalate if needed.** Estate attorney, court orders. Consider cost-benefit—some content isn't worth the legal fight.

## The Better Path: Plan Ahead

All of this is avoidable. A dead man's switch delivers email credentials directly to the executor, bypassing provider processes entirely. Works for every email provider, including zero-knowledge services like ProtonMail where the provider themselves can't help.

Set up Google Inactive Account Manager. Set up Apple Digital Legacy. Store your email password in a dead man's switch. Use a password manager with emergency access features.

If you're an executor, have this conversation with the person *now*—while they can still configure access. Once they're gone, your options narrow dramatically.
    `.trim(),
  },
  {
    slug: "freelancer-digital-asset-protection",
    title: "Freelancer Digital Asset Protection: A Business Continuity Guide",
    description:
      "Freelancers and solopreneurs face unique digital asset risks. Learn how to protect your business continuity with proper digital asset planning.",
    publishedAt: "2024-10-15",
    author: "KeyFate Team",
    category: "Security",
    tags: ["freelancer", "business", "solopreneur", "continuity", "digital assets"],
    readingTime: "6 min read",
    content: `
## You Are a Single Point of Failure

As a freelancer, everything lives in your head and on your devices. Client relationships, project context, account credentials, financial records. There's no HR department, no backup team, no institutional memory. If you're incapacitated tomorrow, your business doesn't pause—it collapses. Clients get stranded. Projects miss deadlines. Years of work becomes inaccessible.

## What Needs Protection

**Client assets:** Contact info, project files, work in progress, communication history, contracts, any login credentials to client systems.

**Business operations:** Website and domain access, social media accounts, email, payment processing (Stripe, PayPal), invoicing platform, cloud storage.

**Financial:** Business bank accounts, tax records, outstanding invoices, recurring payments, crypto received as payment.

**Intellectual property:** Code repositories, design files, written content, photography, proprietary methodologies.

## The Five Steps

**1. Pick your backup person.** A fellow freelancer (reciprocal arrangements work well), a spouse with some business knowledge, or a professional fiduciary. They need to understand enough to communicate with clients professionally and wind things down—or keep them going.

**2. Document operations.** Active clients with contacts and project status. All account credentials. Financial records location. Active deadlines. Subcontractor arrangements. Write it for someone who's never seen your business from the inside.

**3. Set up a dead man's switch.** Store the documentation, credentials, and instructions encrypted in KeyFate. Set a check-in schedule. If you miss check-ins, your backup person gets everything they need.

**4. Write client communication templates.** Your backup person shouldn't have to draft these under stress:

For temporary absence: "I'm [Name], helping manage [Freelancer]'s business while they're unavailable. Your project is important. Here's the current status..."

For permanent absence: "I'm writing with difficult news about [Freelancer]. I'm helping wind down their business affairs. Regarding your project..."

**5. Legal basics.** LLC (protects personal assets), operating agreement addressing incapacity, power of attorney for business matters, professional liability insurance.

## By Freelance Type

**Developers:** Code repos, server access, API keys, client environment credentials, deployment docs. Use a password manager. Keep architecture documentation current.

**Designers:** Figma/Adobe files in organized cloud storage. Document license transferability. Store source files, not just exports. Note client brand asset locations.

**Writers:** CMS access, drafts organized by client/project, editorial calendars, published work archives. Document ghostwriting and confidentiality arrangements.

**Consultants:** Client engagement history, deliverable archives, methodology documentation, key relationship contacts.

## The Reciprocal Arrangement

Find a trusted peer in your field. Each of you sets up a dead man's switch with the other as recipient. Cross-train on basic processes. Agree to handle each other's clients if something happens.

This gives you someone who actually understands freelance work, can communicate professionally with your clients, and might continue the business rather than just shut it down. The mutual benefit keeps both parties engaged in maintaining the arrangement.

## Structuring Your Dead Man's Switch

**Tier 1 (short check-in):** Active clients, urgent deadlines, essential credentials, backup person instructions.

**Tier 2 (longer check-in):** Complete client database, all credentials, financial records, full documentation.

**Tier 3 (business wind-down):** Long-term disposition of assets, IP instructions, final communications to send.
    `.trim(),
  },
  {
    slug: "aes-256-encryption-explained",
    title: "Encryption at KeyFate: AES-256, ChaCha20, and Why We Use Both",
    description:
      "How KeyFate uses ChaCha20-Poly1305 and AES-256-GCM together to protect your secrets. A plain-language explanation of the encryption behind the dead man's switch.",
    publishedAt: "2024-10-10",
    author: "KeyFate Team",
    category: "Technology",
    tags: ["encryption", "chacha20", "aes-256", "security", "cryptography", "technology"],
    readingTime: "6 min read",
    content: `
## Two Ciphers, One Job

KeyFate doesn't rely on a single encryption algorithm. Your secrets are protected by two different ciphers working together:

- **ChaCha20-Poly1305** encrypts secret shares during the double-encryption process—the primary layer that protects data at rest and in transit.
- **AES-256-GCM** handles passphrase-based key derivation via PBKDF2, used when a recipient recovers a secret with a passphrase rather than a Bitcoin timelock.

Both are 256-bit symmetric ciphers. Both are considered unbreakable with current (and foreseeable) technology. They serve different roles because they have different strengths.

## Why ChaCha20-Poly1305?

AES-256 is the more famous name. It's the NIST standard, approved for classified government data, and embedded in virtually every TLS connection on the internet. So why does KeyFate's primary encryption layer use ChaCha20 instead?

**Performance without hardware acceleration.** AES is fast on processors with AES-NI instructions—which covers most modern desktops and servers. But on devices without that hardware support (older phones, embedded systems, some ARM chips), AES slows down significantly. ChaCha20 is fast everywhere because it uses only simple arithmetic operations: addition, rotation, and XOR. No special hardware needed.

**Simpler, which means fewer implementation mistakes.** AES is a substitution-permutation network with lookup tables (S-boxes) that can leak timing information if the implementation isn't careful. Constant-time AES is achievable but requires discipline. ChaCha20's design naturally resists timing side-channel attacks because it doesn't use data-dependent table lookups.

**Poly1305 authentication is built in.** Like AES-GCM, ChaCha20-Poly1305 is an AEAD (Authenticated Encryption with Associated Data) cipher—it encrypts and authenticates in one operation. Tampered ciphertext is rejected before decryption. You get integrity and confidentiality together.

Google chose ChaCha20-Poly1305 for TLS on Android for exactly these reasons. It's the default cipher in WireGuard. It's not exotic—it's battle-tested at enormous scale.

## Where AES-256-GCM Fits

KeyFate uses AES-256-GCM specifically for the passphrase recovery path. When a recipient recovers a secret using a passphrase (rather than a Bitcoin CSV timelock), the key derivation uses PBKDF2 to stretch the passphrase into a 256-bit key, then encrypts with AES-256-GCM.

This is a deliberate choice: the passphrase path involves the Web Crypto API, which has native, audited AES-GCM support in every browser. Using the platform's built-in implementation minimizes the chance of subtle bugs in a security-critical path.

## How Strong Is 256-Bit Encryption?

Both ciphers use 256-bit keys. A 256-bit key space has 2^256 possible values—roughly 1.16 x 10^77 combinations. For perspective, there are approximately 10^80 atoms in the observable universe. You'd run out of atoms before you ran out of keys to try.

Brute-forcing a 256-bit key is not a matter of "we need faster computers." It's a thermodynamic impossibility. Even a hypothetical computer that could test keys at the Landauer limit (the minimum energy to flip a bit) would require more energy than the sun produces to enumerate the key space.

Quantum computers change the math for *asymmetric* cryptography (RSA, elliptic curves), but symmetric ciphers are affected less severely. Grover's algorithm halves the effective key length, meaning AES-256 and ChaCha20-256 would have 128-bit equivalent security against a quantum attacker. 128-bit security is still far beyond brute-force range. This is one reason KeyFate's censorship-resistant recovery layer uses symmetric encryption rather than relying solely on public-key cryptography.

## What Encryption Protects Against

**Server breaches.** If someone compromises KeyFate's database, they get ciphertext—random-looking bytes that reveal nothing without the key. Combined with Shamir's Secret Sharing, even the ciphertext they'd find represents only one share of a split secret. Useless twice over.

**Insider threats.** KeyFate operates a zero-knowledge architecture. The encryption keys never reach our servers. We store encrypted shares and literally cannot decrypt them. This isn't a policy; it's a structural impossibility.

**Network interception.** Data is encrypted client-side before leaving your browser, then travels over TLS. An attacker who intercepts the traffic gets TLS-encrypted ciphertext wrapping application-layer ciphertext. Two layers of noise.

## What Encryption Doesn't Protect Against

**Compromised endpoints.** If malware controls your device, it can capture your secret before encryption happens. No cipher helps if the attacker is sitting between you and your keyboard.

**Bad key management.** A weak passphrase produces a weak derived key. "password123" run through PBKDF2 is still guessable. Use a strong passphrase or, better yet, the Bitcoin timelock recovery path which doesn't depend on passphrase strength at all.

**Social engineering.** Someone who convinces you to hand over your shares has your secret. Encryption protects data, not judgment.

## KeyFate's Encryption Stack

Putting it all together, here's what happens when you store a secret with KeyFate:

1. Your secret is split into shares using Shamir's Secret Sharing on your device
2. Each share is encrypted with ChaCha20-Poly1305 using a per-share random key
3. The encryption key K is itself protected—either locked behind a Bitcoin CSV timelock (published via OP_RETURN when the timelock expires) or encrypted with AES-256-GCM using a PBKDF2-derived key from a passphrase
4. Encrypted shares are distributed: one to KeyFate's server, others to your designated recipients via Nostr relays
5. KeyFate never sees plaintext data, plaintext keys, or enough shares to reconstruct anything

The result: your secret is protected by proven mathematics at every layer, distributed across independent systems, and recoverable only when the right conditions are met—without trusting any single party, including us.
    `.trim(),
  },
  {
    slug: "how-to-pass-on-bitcoin-after-death",
    title: "How to Pass On Bitcoin After Death",
    description:
      "Learn practical methods for passing Bitcoin to your heirs after death. Compare paper backups, multisig wallets, and dead man's switches to find the right approach for your holdings.",
    publishedAt: "2025-02-19",
    author: "KeyFate Team",
    category: "Cryptocurrency",
    tags: ["bitcoin", "inheritance", "cryptocurrency", "estate planning"],
    readingTime: "7 min read",
    content: `
## Bitcoin Dies With You Unless You Plan Ahead

Here's the uncomfortable truth: if you get hit by a bus tomorrow, your Bitcoin is gone. Not frozen, not recoverable through a court order, not sitting in some account your family can petition to unlock. <strong>Gone.</strong> Permanently removed from circulation, as if it never existed.

This isn't hypothetical. Chainalysis estimates that roughly 3.7 million BTC—worth hundreds of billions—are already lost forever. A significant portion of that belongs to people who died without sharing access. Every year, the number grows.

## Why Bitcoin Isn't Like a Bank Account

Traditional financial assets have recovery mechanisms built in. If you die with money in a bank, your executor shows up with a death certificate and a court order. The bank complies. Brokerage accounts, retirement funds, even cash in a safe deposit box—there's always a legal process to transfer ownership.

Bitcoin has no such mechanism. There's no Bitcoin customer service. No central authority. No appeals process. The network doesn't know or care whether a key holder is alive or dead. It only knows whether a valid signature accompanies a transaction. No signature, no access. Period.

This is a feature, not a bug. Bitcoin's censorship resistance and sovereignty come from this design. But that same design means the responsibility for succession planning falls entirely on you.

## The Common Approaches (And Their Problems)

### Paper Backups

Writing your seed phrase on paper and putting it in a safe or safe deposit box is the most common approach. It works, but it has gaps.

Anyone who finds that paper has full access to your funds. Safe deposit boxes get <a href="https://www.consumerfinance.gov/ask-cfpb/what-happens-to-the-contents-of-a-safe-deposit-box-if-it-is-considered-abandoned-en-2089/" target="_blank" rel="noopener noreferrer">sealed during probate</a>, sometimes for months. Paper degrades. Houses flood and burn. And you're trusting that a single piece of paper survives every disaster that might also take you out.

### Multisig Wallets

Multisig (multi-signature) setups require multiple keys to authorize a transaction—for example, 2 of 3 keys. You hold one, your spouse holds one, and a third sits in cold storage. This eliminates single points of failure.

But multisig introduces complexity. Your heirs need to understand how to use it. The wallet software must still be available. And coordinating multiple key holders adds operational overhead that most people won't maintain long-term.

### Trusted Third Parties

Some companies offer to custody your Bitcoin and manage inheritance. This works until the company gets hacked, goes bankrupt, or changes its terms of service. You're reintroducing the centralized trust model that Bitcoin was designed to eliminate.

## The Dead Man's Switch Approach

A <a href="/blog/what-is-a-dead-mans-switch">dead man's switch</a> solves the core tension: keeping your keys secret while you're alive, and delivering them after you're gone.

You encrypt your seed phrase or private key, set a check-in schedule, and designate recipients. As long as you keep checking in, nothing happens. Miss enough check-ins, and the system delivers your information to the people you've chosen.

This approach preserves your sovereignty during your lifetime. No one—not even the service—can access your keys while you're actively checking in. But it creates a reliable handoff mechanism that activates exactly when needed.

## Why KeyFate Is Purpose-Built for This

KeyFate combines a dead man's switch with <a href="/blog/shamirs-secret-sharing-explained">Shamir's Secret Sharing</a> and <a href="/blog/aes-256-encryption-explained">ChaCha20-Poly1305 encryption</a>. Your seed phrase isn't stored anywhere as a complete secret. It's split into cryptographic shares, encrypted on your device, and distributed so that no single party—including KeyFate—can reconstruct it.

Encrypted shares are published to Nostr relays—a decentralized network of independent servers. If KeyFate disappears, your shares persist on those relays, retrievable by your recipients. For maximum trustlessness, the decryption key can be locked behind a Bitcoin CSV timelock that releases automatically after a set number of blocks, with no human in the loop.

When the switch triggers, shares are delivered to your recipients. They combine them to recover the original. The math guarantees that fewer shares than the threshold reveal nothing.

This means:
<ul>
<li>A server breach exposes zero usable data</li>
<li>A rogue employee learns nothing</li>
<li>Your recipients can't access anything prematurely</li>
<li>Your heirs get clear, complete access when it matters</li>
<li>The system works even if KeyFate stops existing</li>
</ul>

The check-in process is simple—confirm you're okay on your chosen schedule. Daily, weekly, monthly. If life gets busy, you get reminders with a grace period before anything triggers.

## What You Should Do Right Now

<strong>Step 1:</strong> Inventory your holdings. Every wallet, every exchange account, every seed phrase.

<strong>Step 2:</strong> Decide who should inherit what. This doesn't need to match your legal will—Bitcoin transfers aren't governed by probate.

<strong>Step 3:</strong> Set up a dead man's switch. <a href="/sign-in">Create a KeyFate account</a>, store your recovery information, and configure your check-in schedule and recipients.

<strong>Step 4:</strong> Tell your recipients they've been designated. They don't need to know what they'll receive—just that they'll get a message from KeyFate if something happens to you.

<strong>Step 5:</strong> Test it. KeyFate lets you verify that your shares reconstruct correctly before you rely on the system.

The process takes about fifteen minutes. The alternative—your family losing access to your Bitcoin forever—takes no time at all. It just happens, silently and irreversibly.

Don't wait. <a href="/pricing">Check out KeyFate's plans</a> and protect your Bitcoin inheritance today.
    `.trim(),
  },
  {
    slug: "digital-dead-mans-switch-explained",
    title: "Digital Dead Man's Switch Explained",
    description:
      "A complete guide to digital dead man's switches: their history, how they work, modern use cases, and how they protect your most sensitive information.",
    publishedAt: "2025-02-19",
    author: "KeyFate Team",
    category: "Technology",
    tags: ["dead mans switch", "digital security", "technology", "automation"],
    readingTime: "8 min read",
    content: `
## From Train Brakes to Encrypted Secrets

The dead man's switch was invented to solve a simple problem: what happens when the person in control can't act anymore?

In the 1880s, railroad engineers held a lever that kept the brakes disengaged. Release the lever—because you passed out, had a heart attack, or fell off the train—and the brakes engaged automatically. No human decision required. The absence of action <em>was</em> the trigger.

The concept spread everywhere safety demanded it. <a href="https://en.wikipedia.org/wiki/Dead_man%27s_switch" target="_blank" rel="noopener noreferrer">Industrial machinery</a>, nuclear launch systems, mining equipment, and military vehicles all adopted variations of the same principle: continuous operator confirmation prevents an automatic safety response.

Now the same principle protects digital secrets. And it's arguably more important than ever.

## What Is a Digital Dead Man's Switch?

A digital dead man's switch monitors whether you're still active. You set a check-in schedule—daily, weekly, monthly—and confirm at regular intervals that you're okay. If you stop checking in, the system assumes something has happened and executes pre-configured actions.

Those actions typically involve releasing encrypted information to designated recipients. Seed phrases, passwords, legal documents, instructions, messages—anything you've stored gets delivered to the people you've chosen.

The critical insight: <strong>the switch activates on the absence of action, not the presence of it.</strong> You don't need to do anything special when disaster strikes. You just need to have set it up beforehand.

## How Modern Digital Dead Man's Switches Work

### The Check-In Cycle

You choose a schedule that matches your risk tolerance and lifestyle. A weekly check-in works for most people. High-risk individuals—journalists in conflict zones, activists under surveillance—might check in daily. The system sends reminders via email, SMS, or push notification when a check-in is due.

### The Grace Period

Missing one check-in doesn't immediately trigger the switch. A configurable grace period accounts for vacations, illness, or simply forgetting. You might set a 7-day check-in with a 14-day grace period, giving you three full weeks before the switch activates.

### The Trigger

Once the grace period expires without a check-in, the system executes. Encrypted secrets are decrypted (or shares are distributed), recipients receive their designated information, and the process is irreversible by design.

### Security Architecture

A well-designed dead man's switch doesn't just store your secrets on a server. KeyFate uses <a href="/blog/shamirs-secret-sharing-explained">Shamir's Secret Sharing</a> to split secrets into shares, <a href="/blog/aes-256-encryption-explained">ChaCha20-Poly1305 encryption</a> for each share, and zero-knowledge architecture so the service itself can't read your data. Encrypted shares are distributed via Nostr relays—a decentralized network that ensures delivery even if KeyFate itself goes offline. This means even if the service is compromised or disappears, your secrets remain protected and deliverable.

## Use Cases

### Cryptocurrency Inheritance

The most common use case. Your <a href="/blog/bitcoin-inheritance-guide">Bitcoin recovery phrase</a> or private keys get delivered to your heirs if you stop checking in. Without this, your crypto dies with you—permanently removed from circulation.

### Journalist Source Protection

Investigative journalists use dead man's switches as insurance. If they're silenced, their research and evidence automatically reach colleagues, editors, or the public. The switch's existence alone can serve as a deterrent—anyone considering silencing the journalist knows the information will be released regardless.

### Whistleblower Assurance

Similar to journalism, whistleblowers can store evidence in a dead man's switch. If retaliation occurs, the evidence is automatically distributed to attorneys, regulators, or media outlets.

### Business Continuity

Small business owners and solo operators hold critical credentials—server access, domain registrars, payment processors, vendor accounts. A dead man's switch ensures a trusted partner or successor can keep operations running. See our guide on <a href="/blog/freelancer-digital-asset-protection">freelancer digital asset protection</a> for more.

### Personal Digital Legacy

Beyond high-stakes scenarios, anyone with a meaningful digital life benefits. Password manager master passwords, <a href="/blog/two-factor-authentication-recovery">two-factor authentication recovery codes</a>, <a href="/blog/email-access-for-executors">email access instructions</a>, and messages to loved ones can all be delivered through a dead man's switch.

## Why Not Just Share Your Passwords Now?

Because sharing secrets prematurely creates immediate risk. The person you trust today might not be trustworthy tomorrow. Relationships change. Devices get compromised. People make mistakes.

A dead man's switch is a time-locked vault. Nobody gets access until the triggering condition is met. During your lifetime, your secrets remain yours alone—protected by encryption that even the service provider can't break.

## What Makes a Good Dead Man's Switch?

<strong>Zero-knowledge encryption.</strong> The service should never be able to read your data. If they can, a breach exposes everything.

<strong>Threshold cryptography.</strong> Your secret should be split so no single point of failure can compromise it. KeyFate uses <a href="/blog/shamirs-secret-sharing-explained">Shamir's Secret Sharing</a> for exactly this purpose.

<strong>Reliable delivery.</strong> Multiple notification channels prevent delivery failure. Email alone isn't enough—what if the recipient's inbox is full?

<strong>Configurable schedules.</strong> Your <a href="/blog/check-in-schedule-best-practices">check-in schedule</a> should match your lifestyle. Rigid systems create false triggers.

<strong>Transparency.</strong> Open architecture and clear documentation let you verify the system works as claimed.

## KeyFate's Approach

KeyFate was built specifically for this problem. Client-side encryption ensures your data is encrypted with ChaCha20-Poly1305 before it ever leaves your device. <a href="/blog/zero-knowledge-security-explained">Zero-knowledge architecture</a> means KeyFate's servers store only encrypted shares—never your complete secret.

Encrypted shares are distributed via Nostr relays for censorship-resistant delivery. For the highest level of trustlessness, the decryption key can be locked behind a Bitcoin CSV timelock—released automatically on-chain after a specified block count, with no human involvement.

Flexible check-in schedules with grace periods prevent false triggers while maintaining security. A complete server compromise reveals nothing usable, and the decentralized distribution means the system works even if KeyFate goes offline.

<a href="/sign-in">Set up your dead man's switch</a> in minutes. Check our <a href="/pricing">pricing page</a> for plan details.
    `.trim(),
  },
  {
    slug: "shamirs-secret-sharing-for-beginners",
    title: "Shamir's Secret Sharing for Beginners",
    description:
      "A beginner-friendly explanation of Shamir's Secret Sharing. Learn how this cryptographic technique splits secrets securely, with simple analogies and real-world applications.",
    publishedAt: "2025-02-19",
    author: "KeyFate Team",
    category: "Education",
    tags: ["cryptography", "shamir secret sharing", "security", "education"],
    readingTime: "7 min read",
    content: `
## The Problem: Sharing a Secret Without Trusting Anyone Completely

You have a secret—say, a Bitcoin seed phrase worth a million dollars. You need someone to access it if something happens to you, but you don't want any single person to have it right now. Not your spouse, not your lawyer, not your best friend. Not because you don't trust them, but because trusting any one person with everything is a single point of failure.

What if you could split that secret into pieces, give each piece to a different person, and make it so that <em>no individual piece reveals anything</em>—but combining enough pieces reconstructs the original perfectly?

That's exactly what Shamir's Secret Sharing does. And it was invented in 1979 by <a href="https://en.wikipedia.org/wiki/Adi_Shamir" target="_blank" rel="noopener noreferrer">Adi Shamir</a>, one of the most important cryptographers in history (the "S" in RSA encryption).

## The Map Analogy

Imagine you have a treasure map. You could tear it into three pieces and give one to each friend. But each piece shows part of the map—someone with one piece gets partial information. And if any piece is lost, the map is ruined.

Shamir's Secret Sharing works differently. Instead of tearing the map, you create three <em>entirely new</em> maps. Each one looks like a complete, valid map—but each leads to a different (wrong) location. Only by overlaying two or more maps together does the real treasure location appear.

That's the magic: each share individually looks like valid data but contains <strong>zero information</strong> about the actual secret. Not partial information. Not a clue. Literally nothing.

## How It Actually Works (No PhD Required)

The math uses polynomial interpolation, but the idea is intuitive.

<strong>Think about connecting dots.</strong> If you have one dot on a graph, infinite lines could pass through it. You have no idea which line is "the" line. But give someone two dots, and exactly one straight line connects them. The secret is where that line crosses the y-axis.

A 2-of-3 scheme works like this: the secret is the y-intercept of a random line. You pick three points on that line—those are your three shares. Any two points define the line (and reveal the y-intercept). But one point alone could belong to any of an infinite number of lines, so it tells you nothing about where the line crosses the y-axis.

For a 3-of-5 scheme, you use a curve (parabola) instead of a line. Three points define a unique parabola. Two points could match infinite parabolas. Five shares exist; any three reconstruct the secret.

The threshold is always one more than the degree of the polynomial. Lines (degree 1) need 2 points. Parabolas (degree 2) need 3 points. And so on.

## Why This Is Better Than Just Splitting

People sometimes "split" a password by giving half to one person and half to another. This is dangerously inferior to Shamir's Secret Sharing.

<strong>Partial information leaks.</strong> If your password is "CorrectHorseBattery" and someone has "CorrectHorse," they've already narrowed the search space dramatically. With Shamir's shares, having one share narrows nothing.

<strong>No redundancy.</strong> If one person loses their half, the password is gone. With a 2-of-3 Shamir scheme, you can lose any one share and still recover.

<strong>Fixed splitting.</strong> With simple splitting, you must decide upfront exactly how to divide. Shamir's lets you create any number of shares with any threshold—3-of-5, 2-of-7, 4-of-10—whatever fits your trust model.

## Real-World Applications

### Cryptocurrency Protection

The most popular use case today. Your <a href="/blog/bitcoin-inheritance-guide">Bitcoin seed phrase</a> is split into shares. You keep one, your spouse gets one via a <a href="/blog/what-is-a-dead-mans-switch">dead man's switch</a>, and a third is stored in a secure backup. No single share grants access to your funds.

### Corporate Key Management

Companies use Shamir's Secret Sharing to protect master encryption keys, root certificates, and critical credentials. A 3-of-5 scheme among executives means no single person—not even the CEO—can unilaterally access the most sensitive systems.

### Nuclear Launch Codes

This isn't hypothetical. Multi-key systems based on secret sharing principles ensure that launching nuclear weapons requires multiple authorized individuals acting together. The concept predates Shamir's algorithm, but the math formalized it.

### Password Manager Recovery

Your <a href="/blog/password-manager-master-password-protection">password manager master password</a> is the key to your entire digital life. Shamir's Secret Sharing lets you create a recovery mechanism that doesn't depend on any single person or location.

## How KeyFate Uses Shamir's Secret Sharing

KeyFate applies Shamir's Secret Sharing at the core of its <a href="/blog/zero-knowledge-security-explained">zero-knowledge security</a> architecture. When you store a secret with KeyFate, it's split into shares on your device—before anything is sent to the server. Each share is encrypted with ChaCha20-Poly1305.

KeyFate stores one encrypted share. Your designated recipients receive their shares when the dead man's switch triggers—delivered via Nostr relays, a decentralized network of independent servers. The threshold is set so that KeyFate's share alone is useless, and your recipients' shares alone are useless. Only when combined after the switch triggers can the secret be reconstructed.

For maximum trustlessness, the decryption key can be locked behind a Bitcoin CSV timelock. The key becomes available on-chain after a specified number of blocks, with no human decision required.

This means:
<ul>
<li>KeyFate can never read your secrets, even if compelled by a court order</li>
<li>A server breach reveals only encrypted, incomplete shares</li>
<li>Your recipients can't access anything before the switch triggers</li>
<li>If KeyFate disappears, shares persist on Nostr relays</li>
<li>The system is mathematically provable, not just "we promise"</li>
</ul>

## Getting Started

You don't need to understand the math to benefit from it. KeyFate handles the cryptography automatically—you just store your secret, choose your recipients, and set your <a href="/blog/check-in-schedule-best-practices">check-in schedule</a>.

If you want to go deeper into the technical details, check out our <a href="/blog/shamirs-secret-sharing-explained">in-depth technical article on Shamir's Secret Sharing</a>.

Ready to protect your secrets with proven cryptography? <a href="/sign-in">Create your KeyFate account</a> and see how it works. View our <a href="/pricing">pricing plans</a> to find the right fit.
    `.trim(),
  },
  {
    slug: "what-happens-to-crypto-when-you-die",
    title: "What Happens to Your Crypto When You Die?",
    description:
      "Explore the legal and practical reality of cryptocurrency after death. Learn about the $140B+ lost Bitcoin problem and how to prevent your crypto from vanishing.",
    publishedAt: "2025-02-19",
    author: "KeyFate Team",
    category: "Cryptocurrency",
    tags: ["cryptocurrency", "inheritance", "bitcoin", "estate planning", "legal"],
    readingTime: "8 min read",
    content: `
## The $140 Billion Graveyard

An estimated 3.7 million Bitcoin are permanently lost. At current prices, that's over $140 billion in value that no one will ever access again. Some of those coins belong to early adopters who lost hard drives. Some belong to people who forgot passwords. And a significant—growing—portion belongs to people who died.

Unlike every other asset class in human history, cryptocurrency has no institutional recovery mechanism. When you die holding the only copy of your private keys, those coins don't go to your estate. They don't go to the government. They don't go anywhere. They remain on the blockchain, visible to everyone, accessible to no one—forever.

This isn't a theoretical problem. It's happening right now, every single day.

## The Legal Reality

### Crypto Is Property (Usually)

Most jurisdictions now treat cryptocurrency as property for estate and tax purposes. The <a href="https://www.irs.gov/individuals/international-taxpayers/frequently-asked-questions-on-virtual-currency-transactions" target="_blank" rel="noopener noreferrer">IRS classifies it as property</a>. Courts have ruled it can be inherited. On paper, your crypto belongs to your estate when you die.

But legal ownership and practical access are completely different things.

### The Access Problem

Your executor has the legal right to manage your crypto assets. A probate court can declare your heir the rightful owner. None of that matters if nobody has the private keys. The blockchain doesn't recognize court orders. It doesn't verify death certificates. It responds only to valid cryptographic signatures.

This creates a bizarre situation: your heirs legally own an asset they can never touch.

### Exchange Accounts Offer Partial Relief

If your crypto is on an exchange like Coinbase or Kraken, your heirs may be able to access it through the exchange's death verification process—typically requiring a death certificate, proof of estate, and legal documentation. It's slow and bureaucratic, but it works.

But if your crypto is in a self-custody wallet—which is how most serious holders store significant amounts—there's no third party to petition.

## The Horror Stories

<strong>Gerald Cotten and QuadrigaCX.</strong> When the CEO of Canadian exchange QuadrigaCX died in 2018, he reportedly took the private keys to $190 million in customer funds to his grave. (The full story is more complicated—and possibly criminal—but the core problem was real: one person, one set of keys, no backup.)

<strong>Stefan Thomas and his IronKey.</strong> A programmer in San Francisco holds 7,002 Bitcoin (worth hundreds of millions) on an encrypted IronKey drive. He forgot the password. He has two guesses left before the drive wipes itself. He's not dead, but the outcome is identical: the coins are effectively lost.

<strong>James Howells and the landfill.</strong> A Welsh IT worker accidentally threw away a hard drive containing 8,000 Bitcoin. He's been trying to get permission to excavate a landfill for years. The council won't allow it.

These stories get headlines. The thousands of ordinary people who die each year with unrecoverable crypto do not.

## Why People Don't Plan

Cryptocurrency holders are, ironically, among the worst at succession planning. The reasons are predictable.

<strong>"I'll do it later."</strong> Death feels abstract, especially for the young demographic that dominates crypto. The urgency never materializes—until it's too late.

<strong>Security paranoia works against planning.</strong> The same mindset that drives people to self-custody and operational security makes them reluctant to share keys or create recovery mechanisms. They've been told—correctly—that sharing keys is dangerous. But they overcorrect into sharing them with nobody.

<strong>Complexity breeds procrastination.</strong> Setting up multisig wallets, writing detailed instructions, and coordinating with heirs is tedious. So it stays on the to-do list.

<strong>The tools haven't existed.</strong> Until recently, there was no good option between "share your keys now" and "hope for the best." Traditional estate planning doesn't understand crypto. Crypto tools don't address death.

## The Solutions

### Option 1: Detailed Written Instructions

Write down your seed phrases, wallet types, exchange accounts, and step-by-step recovery instructions. Store them in a secure location your heirs know about.

<strong>Pros:</strong> Simple, no technology required. <strong>Cons:</strong> Anyone who finds the document has full access. Paper degrades. Instructions may become outdated.

### Option 2: Multisig Wallets

Set up a wallet requiring multiple keys to spend. Distribute keys among trusted parties.

<strong>Pros:</strong> No single point of failure. <strong>Cons:</strong> Complex to set up and maintain. Requires technical knowledge from heirs. Wallet software compatibility is a long-term risk.

### Option 3: Dead Man's Switch with Threshold Cryptography

Store your recovery information in an encrypted <a href="/blog/what-is-a-dead-mans-switch">dead man's switch</a> that uses <a href="/blog/shamirs-secret-sharing-explained">Shamir's Secret Sharing</a> to eliminate single points of failure. KeyFate distributes encrypted shares via Nostr relays (censorship-resistant, survives even if KeyFate goes offline) and can lock the decryption key behind a Bitcoin CSV timelock for fully trustless, automated release.

<strong>Pros:</strong> No premature access. No single point of failure. Activates automatically. No technical knowledge required from heirs. Works even if the service provider disappears. <strong>Cons:</strong> Requires regular check-ins.

## What You Should Do

<strong>If you hold crypto on exchanges only:</strong> Make sure your exchange accounts are documented in your estate plan. Name beneficiaries where possible. Store login credentials securely with your <a href="/blog/digital-estate-planning-checklist">estate planning documents</a>.

<strong>If you self-custody any amount:</strong> You need a recovery mechanism. A dead man's switch is the most reliable option that doesn't compromise your security during your lifetime.

<strong>If you hold significant amounts:</strong> Use multiple layers. A dead man's switch for your seed phrases, documented exchange accounts for custodied assets, and clear instructions for your executor about what exists and where.

Don't become a statistic. <a href="/sign-in">Set up a KeyFate dead man's switch</a> and make sure your crypto survives you. It takes fifteen minutes and costs less than a single transaction fee. See <a href="/pricing">pricing details here</a>.
    `.trim(),
  },
  {
    slug: "vendor-lock-in-secret-management",
    title: "Vendor Lock-in: The Silent Threat to Your Secret Management",
    description:
      "Why centralized secret management platforms create dangerous vendor lock-in, and how to protect your critical infrastructure with portable, open approaches.",
    publishedAt: "2025-02-19",
    author: "KeyFate Team",
    category: "Security",
    tags: ["security", "vendor lock-in", "secret management", "data portability", "infrastructure"],
    readingTime: "7 min read",
    content: `
## Your Secrets Are Only as Safe as the Vendor Holding Them

You've chosen a secret management platform. You've migrated your API keys, database credentials, encryption keys, and access tokens. Your CI/CD pipelines pull from it. Your applications depend on it. Your team has built workflows around it.

Then the vendor gets acquired. Or raises prices 300%. Or suffers a breach. Or sunsets the product.

Now what?

Vendor lock-in in secret management isn't just an inconvenience. It's a <strong>security risk</strong>. When your ability to access, migrate, or control your own secrets depends on a single company's continued existence and goodwill, you've created exactly the kind of single point of failure that good security practice is supposed to eliminate.

## How Lock-In Happens

### Proprietary Formats

Many secret management platforms store secrets in proprietary formats or behind proprietary APIs. Your data goes in through their SDK, lives in their format, and can only come out through their tools. If those tools stop working—or stop being available—extraction becomes a crisis project.

### Deep Integration Dependencies

Modern secret managers integrate with everything: cloud providers, CI/CD systems, container orchestrators, application frameworks. Each integration creates a dependency. Migrating means rewiring every integration point, often across hundreds of services and dozens of teams. The switching cost grows with every integration you add.

### Contractual and Economic Traps

Some vendors offer steep initial discounts that normalize into much higher renewal pricing. Others include data egress fees, per-secret charges, or API rate limits designed to make leaving expensive. By the time the true cost becomes clear, you're too deeply embedded to easily switch. <a href="https://www.cisa.gov/resources-tools/resources/secure-by-design" target="_blank" rel="noopener noreferrer">CISA's Secure by Design principles</a> advocate for transparent, user-controlled security—not architectures that create dependency.

## Real Consequences

### Vendor Shutdowns

When a secret management vendor shuts down, you're on a countdown timer. Every secret needs to be extracted, reformatted, and re-integrated before the lights go off. If the shutdown is abrupt—due to bankruptcy, for example—you may not get a countdown at all.

### Acquisitions and Pivots

Acquisitions change everything. The new owner may deprecate features you rely on, change pricing, alter security practices, or shut down the product entirely to absorb the team. Product pivots are equally disruptive—your critical infrastructure tool becomes someone's AI experiment overnight.

### Security Incidents

When your secret manager is breached, the response depends entirely on the vendor's transparency and competence. If they downplay the severity, delay notification, or provide inadequate remediation guidance, your secrets are exposed and you're dependent on a compromised party to help you recover. You're locked in with a vendor you can no longer trust.

### Compliance Complications

Regulatory requirements around data sovereignty, audit trails, and access controls may change. If your vendor can't adapt—or decides compliance with your specific requirements isn't worth their engineering investment—you're stuck between regulatory obligations and technical constraints.

## The Portability Imperative

Good secret management should follow the same principles as good data management: <strong>your data should be yours</strong>.

This means open, documented formats that don't require proprietary tools to read. Standard APIs and protocols that work across platforms. Export capabilities that produce complete, usable data. No contractual barriers to leaving.

If you can't export your secrets in a standard format and import them into a competitor in the same afternoon, you don't own your secrets—your vendor does.

## What to Look For in a Secret Management Approach

<strong>Client-side encryption.</strong> If secrets are encrypted on your device before reaching the server, the vendor holds only ciphertext. You control the keys. This fundamentally limits the vendor's power over your data, and it's the approach KeyFate uses with <a href="/blog/aes-256-encryption-explained">ChaCha20-Poly1305 and AES-256-GCM encryption</a>.

<strong>Open standards.</strong> <a href="/blog/shamirs-secret-sharing-explained">Shamir's Secret Sharing</a> is a published, well-understood algorithm. AES-256 is a public standard. When your security relies on open mathematics rather than proprietary black boxes, you're not dependent on any single implementation.

<strong>Data export.</strong> You should be able to extract your data at any time, in a format you can use independently. This isn't a feature—it's a <a href="/blog/zero-knowledge-security-explained">fundamental right</a> in any zero-knowledge system.

<strong>Transparent architecture.</strong> Understanding exactly how your secrets are stored, encrypted, split, and delivered lets you verify the system's security properties and plan for migration if needed.

## KeyFate's Approach to Avoiding Lock-In

KeyFate is designed around the principle that your secrets should never depend on KeyFate's existence.

<strong>Client-side encryption</strong> with ChaCha20-Poly1305 means your secrets are encrypted before they reach our servers. If KeyFate disappeared tomorrow, you'd still hold your encryption keys locally.

<strong>Shamir's Secret Sharing</strong> using standard, published algorithms means the shares we distribute can be reconstructed with any correct implementation of the algorithm—not just our software.

<strong>Nostr relay distribution</strong> means encrypted shares are published to a decentralized network of independent servers. KeyFate shutting down doesn't destroy your shares—they persist on relays across multiple jurisdictions, retrievable by your recipients.

<strong>Bitcoin CSV timelocks</strong> for decryption key release use the Bitcoin blockchain itself as a trustless timer. No KeyFate involvement required for key release when the timelock expires.

<strong>Zero-knowledge architecture</strong> means we literally cannot hold your secrets hostage. We never have them in a usable form. Your data, encrypted with your keys, split using open mathematics, distributed across infrastructure we don't control.

This isn't a competitive moat—it's a deliberate design choice. The best security tools are the ones you could walk away from at any time and still maintain access to your own data.

## Evaluating Your Current Setup

Ask these questions about your current secret management:
<ul>
<li>Can you export all secrets in a standard format today?</li>
<li>If the vendor shut down in 30 days, could you migrate in time?</li>
<li>Are your secrets encrypted with keys you control?</li>
<li>Does the system use open, documented algorithms?</li>
<li>Could you reconstruct your secrets without the vendor's software?</li>
</ul>

If the answer to any of these is "no" or "I don't know," you have a vendor lock-in problem. And that problem will only get worse as you add more secrets and integrations.

Take control of your secrets. <a href="/sign-in">Try KeyFate</a> and experience secret management built on open standards, client-side encryption, and zero vendor lock-in. <a href="/pricing">View pricing</a> to get started.
    `.trim(),
  },
]

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug)
}

export function getAllBlogPosts(): BlogPost[] {
  return blogPosts.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}

export function getFeaturedPosts(): BlogPost[] {
  return blogPosts.filter((post) => post.featured)
}

export function getPostsByCategory(category: string): BlogPost[] {
  return blogPosts.filter((post) => post.category === category)
}

export function getPostsByTag(tag: string): BlogPost[] {
  return blogPosts.filter((post) => post.tags.includes(tag))
}

export function getAllCategories(): string[] {
  return [...new Set(blogPosts.map((post) => post.category))]
}

export function getAllTags(): string[] {
  return [...new Set(blogPosts.flatMap((post) => post.tags))]
}
