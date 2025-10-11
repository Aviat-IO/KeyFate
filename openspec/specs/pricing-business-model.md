# Pricing & Business Model for KeyFate

## Feature Requirements (Based on Pricing Table)

### Free Tier
- 1 secret maximum (active or paused)
- 1 recipient per secret (email only)
- Available intervals: 1 week, 1 month, 1 year (3 fixed intervals)
- No message templates
- Community support only

### Pro Tier
- Up to 10 secrets maximum (active or paused)
- Up to 5 recipients per secret (email only)
- Very flexible check-in intervals: 1 day, 3 days, 7 days, 2 weeks, 1 month, 3 months, 6 months, 12 months, 3 years (9 custom intervals)
- Message templates (feature deferred pending requirements clarification)
- Email support

### Important Tier Enforcement Details
- **Secret counting:** Count secrets with `status = 'active'` OR `status = 'paused'` (exclude only `triggered` and deleted secrets)
- **Downgrade handling:** Grandfather existing secrets, prevent new secret creation if over new limit
- **Server-side validation:** All tier limits must be enforced server-side in API endpoints, not just in UI
- **Contact methods:** Email only until SMS feature is implemented

## Payment Processing

### Stripe Integration
- Credit card payment processing
- Subscription management and lifecycle
- Webhook handling for payment events
- Prorated billing for upgrades/downgrades

### BTCPay Server Integration
- Bitcoin payment processing (self-hosted)
- Anonymous payment option
- Lightning Network support
- Integration with subscription system

## Technical Requirements

### Database Schema
- User subscription tracking
- Tier limits and capabilities
- Usage tracking and enforcement
- Payment history

### Feature Gating
- Server-side enforcement of tier limits
- Secret creation restrictions
- Recipient limit enforcement
- Check-in interval restrictions
- Usage indicators in UI

### Security & Compliance
- PCI DSS compliance through payment processors
- Secure webhook signature verification
- User data protection during payment flow
- Subscription data encryption

## Business Logic

### Subscription Lifecycle
1. User signs up (default: Free tier)
2. User can upgrade to Pro tier via Stripe or BTCPay
3. Active subscription grants Pro tier features
4. Failed payment triggers dunning process
5. Expired subscription reverts to Free tier (with grandfathering)

### Grandfathering Policy
- Users who downgrade keep existing secrets
- Cannot create new secrets if over new tier limit
- Existing secrets remain functional
- Clear UI messaging about tier status

### Usage Tracking
- Calculate on-demand from database for accuracy
- Cache for performance where appropriate
- Real-time enforcement at API level
- UI indicators show current usage vs limits

## Future Considerations

### Planned Features
- SMS notifications (additional paid feature)
- Message templates (requirements pending)
- B2B tier with enhanced features
- Nostr integration for uncensorable disclosure
- Enhanced support tiers

### Pricing Tiers (To Be Determined)
- Monthly Pro subscription: TBD
- Annual Pro subscription: TBD (discounted)
- Bitcoin discount incentive: Possible
- B2B pricing: Future consideration
