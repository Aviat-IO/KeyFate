# Blog Article Generation Guide

This document provides instructions for generating high-quality, SEO-optimized blog articles for KeyFate.

## Project Context

Before writing any article, review `@/openspec/project.md` to understand:

- **KeyFate** is a secure dead man's switch platform using client-side Shamir's Secret Sharing
- **Target Audience**: Cryptocurrency holders, journalists, activists, estate planners
- **Key Value Proposition**: Zero-knowledge architecture - we never have access to user secrets
- **Technical Foundation**: Client-side encryption, threshold security (2-of-3 minimum)
- **Tiers**: Free (1 secret, basic features) and Pro (10 secrets, advanced features)

## Writing Guidelines

### Tone and Style

1. **Straight to the point** - No fluff, filler, or unnecessary padding
2. **Informative and educational** - Teach readers something valuable
3. **Authoritative but accessible** - Expert knowledge in plain language
4. **Action-oriented** - Give readers clear next steps
5. **Trust-building** - Establish KeyFate as a credible security solution

### Content Structure

Every article should follow this structure:

```markdown
## Opening Hook (1-2 paragraphs)
State the problem or question clearly in prose. Explain why this matters
to the reader and preview what they'll learn. Draw them in with a
compelling narrative, not a list of bullet points.

## Main Content (3-5 sections)
Use clear H2 headings for each section. Write in flowing paragraphs that
explain concepts thoroughly. Include practical examples and scenarios
woven naturally into the text. Reserve bullet lists only for true
comparisons or step-by-step instructions.

## Conclusion (1-2 paragraphs)
Summarize key takeaways in prose form. Include a soft CTA relating to
KeyFate when it fits naturally into the narrative.
```

### SEO Best Practices

1. **Title**: Include primary keyword, keep under 60 characters
2. **Description**: 150-160 characters, include keywords naturally
3. **Headings**: Use H2 and H3 with relevant keywords
4. **Tags**: Include 3-5 relevant tags for discoverability
5. **Internal linking**: Reference other KeyFate pages where appropriate
6. **Reading time**: Target 5-8 minutes (1,200-2,000 words)

### Formatting for Readability

**Favor prose over lists.** Well-written paragraphs are more engaging and professional than bullet points. Use lists sparingly and only when they genuinely improve comprehension.

**When to use lists:**
- Comparing 3+ distinct items side-by-side
- Step-by-step instructions where sequence matters
- Quick reference summaries at the end of sections

**When NOT to use lists:**
- Explaining concepts (use paragraphs instead)
- Describing features or benefits (weave into narrative)
- Making arguments (prose is more persuasive)
- When you have fewer than 3 items

**Other formatting guidelines:**
- Short paragraphs (3-4 sentences max)
- Bold for emphasis on key terms (sparingly)
- Use practical examples and scenarios woven into prose
- Break up long sections with subheadings, not bullet lists

## Adding a New Article

Add new articles to `/frontend/src/lib/blog/posts.ts`:

```typescript
{
  slug: "your-article-slug",
  title: "Your Article Title",
  description: "150-160 character description with keywords",
  publishedAt: "YYYY-MM-DD",
  author: "KeyFate Team",
  category: "Education | Cryptocurrency | Technology | Estate Planning | Security",
  tags: ["keyword1", "keyword2", "keyword3"],
  readingTime: "X min read",
  featured: false, // Set to true for homepage feature
  content: `
## Heading 1

Content here...

## Heading 2

More content...
  `.trim(),
}
```

---

## Future Blog Post Ideas

### High Priority (Core Topics)

- [ ] "Bitcoin Inheritance: A Complete Guide for Hodlers"
- [ ] "How to Set Up a Check-In Schedule That Works"
- [ ] "Understanding Zero-Knowledge Security Architecture"
- [ ] "Digital Will vs Dead Man's Switch: Key Differences"
- [ ] "Protecting Your Password Manager Master Password"

### Cryptocurrency Focus

- [ ] "Cold Storage Inheritance Planning"
- [ ] "Multi-Sig vs Shamir's Secret Sharing for Crypto Security"
- [ ] "Exchange Account Access After Death: What Your Family Needs"
- [ ] "DeFi Wallet Recovery: A Guide for Heirs"
- [ ] "NFT Inheritance: Ensuring Digital Art Survives"

### Estate Planning

- [ ] "Digital Assets Your Estate Plan is Missing"
- [ ] "How to Document Your Digital Life for Heirs"
- [ ] "Subscription Services After Death: A Management Guide"
- [ ] "Social Media Accounts: Delete or Memorialize?"
- [ ] "Email Access for Executors: Legal and Practical Guide"

### Security Education

- [ ] "Two-Factor Authentication Recovery Planning"
- [ ] "Encrypted Cloud Storage: Access After Death"
- [ ] "Password Sharing Security Best Practices"
- [ ] "Why Traditional Safe Deposit Boxes Fail for Digital Assets"
- [ ] "Security Questions: The Weak Link in Account Recovery"

### Use Case Stories

- [ ] "How Crypto Investors Use Dead Man's Switches"
- [ ] "Freelancer Digital Asset Protection"
- [ ] "Small Business Owner Digital Succession"
- [ ] "Solo Traveler Security Planning"
- [ ] "Remote Worker Digital Legacy Planning"

### Technical Deep Dives

- [ ] "AES-256 Encryption Explained Simply"
- [ ] "Client-Side vs Server-Side Encryption"
- [ ] "Threshold Cryptography: Beyond 2-of-3"
- [ ] "How Email Verification Protects Your Recipients"
- [ ] "The Mathematics of Unbreakable Secret Splitting"

### Comparison Articles (SEO Value)

- [ ] "KeyFate vs Legacy Contact (Google) - Complete Comparison"
- [ ] "Dead Man's Switch Services Compared [Current Year]"
- [ ] "Paper Wallets vs Digital Dead Man's Switch"
- [ ] "Hardware Wallet Backup Methods Compared"

---

## Article Template

Use this template when creating new articles:

```typescript
{
  slug: "",
  title: "",
  description: "",
  publishedAt: "",
  author: "KeyFate Team",
  category: "",
  tags: [],
  readingTime: "",
  content: `
## [Opening Section Title]

[Hook paragraph that draws the reader in by stating the problem clearly
and explaining why it matters to them personally.]

[Second paragraph expanding on the stakes and previewing what they'll
learn from this article.]

## [Main Section 1]

[Explain the concept in clear, flowing prose. Use concrete examples
to illustrate abstract ideas. Keep paragraphs short but substantive.]

[Continue developing the idea across multiple paragraphs rather than
breaking into bullet points.]

### [Subsection if needed]

[More detailed explanation in prose form. Only use a bullet list if
you're comparing 3+ distinct items or providing step-by-step instructions.]

## [Main Section 2]

[Continue with engaging prose that teaches and informs.]

## [Main Section 3]

[Build toward your conclusion with practical insights.]

## Conclusion

[Summarize the key insights in a paragraph or two. End with a natural
call-to-action that connects to KeyFate's value proposition.]
  `.trim(),
}
```

---

## Content Review Checklist

Before publishing, verify:

- [ ] Title is under 60 characters and includes primary keyword
- [ ] Description is 150-160 characters
- [ ] Content is straight to the point (no filler)
- [ ] **Prose over lists**: Most content is in paragraph form, not bullets
- [ ] Lists are used sparingly (only for comparisons or steps)
- [ ] All claims are accurate and verifiable
- [ ] Technical details align with KeyFate's actual features
- [ ] Reading time is calculated correctly (~200 words per minute)
- [ ] Category and tags are appropriate
- [ ] Links to external resources are current
- [ ] CTA is natural, not forced
- [ ] Proofread for grammar and clarity
