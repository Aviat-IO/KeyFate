# Email Template System Documentation

## Overview

The email template system provides professional, responsive email templates with consistent branding and email client compatibility. All templates use a **600px max-width constraint** for optimal rendering across desktop and mobile email clients.

## Architecture

### Template Files

- **`/src/lib/email/templates.ts`** - Core email templates (verification, reminder, disclosure, base)
- **`/src/lib/services/email-templates.ts`** - Payment and subscription templates

### Key Features

1. **Max-Width Constraint**: All emails constrained to 600px for professional appearance
2. **Table-Based Layout**: Uses HTML tables for maximum email client compatibility (Outlook, Gmail, etc.)
3. **Responsive Design**: Mobile-first approach with responsive padding and centering
4. **Inline Styles**: Critical layout properties use inline styles for Gmail compatibility
5. **Consistent Branding**: Unified design system across all email types

## Template Types

### Base Template

The foundation for all email templates with consistent branding.

```typescript
import { renderBaseTemplate } from "@/lib/email/templates";

const email = renderBaseTemplate({
  title: "Welcome to KeyFate",
  content: "<p>Your custom email content here...</p>",
  footerText: "Optional custom footer text",
});
```

**Features**:
- Centered layout with 600px max-width
- Company branding header
- Responsive content area
- Consistent footer with copyright

### Verification Email

Email address verification template.

```typescript
import { renderVerificationTemplate } from "@/lib/email/templates";

const email = renderVerificationTemplate({
  verificationUrl: "https://example.com/verify?token=abc123",
  expirationHours: 24,
  userName: "John Doe", // Optional
  supportEmail: "support@example.com", // Optional
});
```

**Features**:
- Prominent call-to-action button
- Expiration warning
- Fallback URL for manual copying
- Support contact information

### Reminder Email

Check-in reminder with urgency levels.

```typescript
import { renderReminderTemplate } from "@/lib/email/templates";

const email = renderReminderTemplate({
  userName: "Jane Smith",
  secretTitle: "Important Document",
  daysRemaining: 2,
  checkInUrl: "https://example.com/checkin/123",
  urgencyLevel: "high", // low, medium, high, critical
});
```

**Features**:
- Color-coded urgency levels
- Time remaining display (days or hours)
- Prominent check-in button
- Clear consequences messaging

**Urgency Levels**:
- `low` - Blue, scheduled reminder
- `medium` - Blue, important reminder
- `high` - Red, urgent warning
- `critical` - Red, final warning

### Disclosure Email

Confidential information disclosure with security warnings.

```typescript
import { renderDisclosureTemplate } from "@/lib/email/templates";

const email = renderDisclosureTemplate({
  contactName: "Emergency Contact",
  secretTitle: "Family Emergency Info",
  senderName: "John Doe",
  message: "Personal message to recipient",
  secretContent: "Confidential information...",
  disclosureReason: "scheduled", // or "manual"
  senderLastSeen: new Date(),
});
```

**Features**:
- Security warning banner
- Sender information and last seen date
- Personal message section
- Formatted secret content
- Security best practices reminder

## Layout System

### Table-Based Structure

All emails use a nested table structure for maximum compatibility:

```html
<!-- Outer wrapper table (100% width, centered) -->
<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center">
      <!-- Inner content table (600px max-width) -->
      <table width="100%" style="max-width: 600px;">
        <tr>
          <td>
            <!-- Email content here -->
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

### Why Tables?

1. **Outlook Compatibility**: Outlook uses Word rendering engine which has poor CSS support
2. **Gmail Compatibility**: Gmail strips many CSS properties but preserves table layouts
3. **Apple Mail**: Works perfectly with table-based layouts
4. **Consistent Rendering**: Tables provide predictable layout across all clients

## Email Client Compatibility

### Tested Clients

- ✅ Gmail (web and mobile)
- ✅ Outlook (2016, 2019, 365, web)
- ✅ Apple Mail (macOS and iOS)
- ✅ Yahoo Mail
- ✅ Thunderbird
- ✅ Mobile clients (iOS Mail, Android Gmail)

### Compatibility Techniques

1. **Inline Styles**: Critical properties like `max-width`, `padding`, `text-align` are inline
2. **Table Attributes**: Use `cellpadding="0"`, `cellspacing="0"`, `border="0"`
3. **Width Attributes**: Use both `width="100%"` attribute and `max-width: 600px` style
4. **Center Alignment**: Use `align="center"` on table cells for horizontal centering
5. **Responsive Images**: All images use `max-width: 100%; height: auto;`

## Responsive Design

### Mobile Optimization

```html
<!-- Viewport meta tag for mobile -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

**Features**:
- 100% width tables collapse to screen width on mobile
- Max-width constraint prevents overflow on desktop
- Responsive padding adjusts for small screens
- Touch-friendly button sizing (minimum 44px height)

### Breakpoints

The template system uses fluid design rather than fixed breakpoints:

- **Desktop (>600px)**: Email displays at 600px max-width, centered
- **Tablet (600px)**: Email uses full width with padding
- **Mobile (<600px)**: Email uses full width with reduced padding

## Testing

### Unit Tests

```bash
# Run all template tests
npm test -- __tests__/lib/email-templates.test.ts

# Run layout constraint tests
npm test -- __tests__/lib/email/email-wrapper-layout.test.ts

# Generate visual samples
npm test -- __tests__/lib/email/email-visual-rendering.test.ts
```

### Visual Testing

Visual test samples are generated in `__tests__/lib/email/output/`:

1. `verification-email.html`
2. `reminder-email-high-urgency.html`
3. `disclosure-email.html`
4. `custom-base-email.html`
5. `long-content-email.html`

**How to test**:
1. Run visual rendering tests to generate samples
2. Open HTML files in browser for desktop view
3. Use browser DevTools responsive mode for mobile testing
4. Send test emails to actual email accounts for real-world testing

### Manual Testing Checklist

- [ ] Desktop browser rendering (Chrome, Firefox, Safari)
- [ ] Mobile browser rendering (iOS Safari, Android Chrome)
- [ ] Gmail web client
- [ ] Gmail mobile app
- [ ] Outlook desktop client
- [ ] Outlook web client
- [ ] Apple Mail (macOS and iOS)
- [ ] Dark mode compatibility
- [ ] Screen reader accessibility
- [ ] Link clickability
- [ ] Button touch targets (mobile)

## Best Practices

### When Creating New Templates

1. **Start with Base Template**: Use `renderBaseTemplate()` for consistent branding
2. **Use Inline Styles**: Critical layout properties must be inline
3. **Test in Multiple Clients**: Always test in Gmail, Outlook, and Apple Mail
4. **Keep Tables Simple**: Avoid deeply nested tables (max 2-3 levels)
5. **Use Web-Safe Fonts**: Stick to Arial, Helvetica, Georgia, Times New Roman
6. **Optimize Images**: Use CDN, optimize file size, include alt text
7. **Include Text Version**: Always provide plain text alternative

### Content Guidelines

1. **Keep Subject Lines Short**: 40-60 characters for mobile compatibility
2. **Clear Call-to-Action**: One primary CTA per email
3. **Above-the-Fold Content**: Most important info in first 300px
4. **Scannable Content**: Use headings, bullets, short paragraphs
5. **Accessible Design**: Sufficient color contrast, alt text for images

### Performance

1. **Image Optimization**: Compress images, use appropriate formats
2. **Minimal CSS**: Keep styles minimal and inline when possible
3. **No JavaScript**: Email clients block JavaScript
4. **Total Size**: Keep total email under 100KB for best deliverability

## Troubleshooting

### Common Issues

**Issue**: Email not centered in Outlook
- **Solution**: Ensure outer table has `align="center"` on the containing `<td>`

**Issue**: Max-width ignored in Gmail
- **Solution**: Use inline `style="max-width: 600px"` on inner table

**Issue**: Images too large on mobile
- **Solution**: Add `style="max-width: 100%; height: auto;"` to all images

**Issue**: Buttons not clickable on mobile
- **Solution**: Ensure buttons have minimum 44px height and proper padding

**Issue**: Dark mode makes text unreadable
- **Solution**: Avoid absolute white/black backgrounds, use semantic colors

### Debug Tips

1. **Use Email Testing Services**: Litmus, Email on Acid for comprehensive testing
2. **Check Inline Styles**: Use browser DevTools to verify inline styles are present
3. **Validate HTML**: Use W3C validator to catch syntax errors
4. **Test Plain Text**: Verify plain text version is readable
5. **Check Spam Score**: Use Mail Tester or similar services

## Migration Guide

### Updating Existing Templates

If you have existing email templates that need the max-width constraint:

1. **Replace div-based layout with tables**:
   ```html
   <!-- Before -->
   <div class="container">Content</div>

   <!-- After -->
   <table width="100%" cellpadding="0" cellspacing="0">
     <tr>
       <td>Content</td>
     </tr>
   </table>
   ```

2. **Move critical styles inline**:
   ```html
   <!-- Before -->
   <div class="header">Header</div>

   <!-- After -->
   <td style="text-align: center; padding: 20px;">Header</td>
   ```

3. **Add max-width constraint**:
   ```html
   <table width="100%" style="max-width: 600px;">
   ```

4. **Test thoroughly** in all major email clients

## Future Enhancements

Potential improvements for the template system:

- [ ] A/B testing framework for email templates
- [ ] Template preview API endpoint
- [ ] Multi-language support
- [ ] Dynamic component library
- [ ] Email analytics integration
- [ ] Automated screenshot testing
- [ ] Template versioning system
- [ ] MJML integration for easier authoring

## Resources

- [Email Client CSS Support](https://www.caniemail.com/)
- [HTML Email Best Practices](https://www.campaignmonitor.com/dev-resources/)
- [Litmus Email Testing](https://litmus.com/)
- [Email on Acid](https://www.emailonacid.com/)
- [MJML Framework](https://mjml.io/)
- [Really Good Emails](https://reallygoodemails.com/)

## Support

For questions or issues with email templates:

1. Check this documentation
2. Review test files for examples
3. Generate visual samples for debugging
4. Contact the development team
