# Pricing for KeyFate

## 📋 REQUIREMENTS ANALYSIS

### Feature Requirements (Based on Pricing Table)
**Free Tier:**
- 1 secret maximum
- 1 recipient per secret
- Available intervals: 1 week, 1 month, 1 year
- No message templates
- Community support only

**Pro Tier:**
- Up to 10 secrets maximum
- Up to 5 recipients per secret
- Very flexible check-in intervals: 1 day, 3 days, 7 days, 2 weeks, 1 month, 3 months, 6 months, 12 months, 3 years
- Message templates
- Email support

### Technical Requirements
- Integrate Paddle Billing for subscription management
- Database schema updates for user tiers and limits
- Feature gating throughout the application
- Subscription management UI
- Webhook handling for payment events
- Usage tracking and enforcement

## 🧩 COMPONENTS AFFECTED

### Database Schema Changes (Supabase)
- New `user_subscriptions` table
- New `user_tiers` table
- New `subscription_usage` table for tracking limits

### Frontend Components
- New pricing page component
- Subscription management dashboard
- Feature upgrade prompts
- Usage indicators and limits UI
- Payment method management

### Backend Functions (Supabase Edge Functions)
- Paddle webhook handler
- Subscription status sync
- Usage limit enforcement
- Tier-based feature gating middleware

### API Integration
- Paddle Billing API integration
- Customer creation and management
- Subscription lifecycle management
- Payment method handling

## 🏗️ ARCHITECTURE CONSIDERATIONS

### Security & Compliance
- PCI DSS compliance through Paddle (merchant of record)
- Secure webhook signature verification
- User data protection during payment flow
- Subscription data encryption

### Scalability
- Usage tracking optimization
- Efficient tier checking mechanisms
- Caching for subscription status
- Rate limiting for API calls

### User Experience
- Seamless upgrade flow
- Clear usage indicators
- Graceful degradation when limits reached
- Payment failure handling

## 📝 IMPLEMENTATION STRATEGY

### Phase 1: Database & Core Infrastructure
1. **Database Schema Updates**
   - Create subscription-related tables
   - Add tier enforcement fields
   - Set up usage tracking structures

2. **Paddle Integration Setup**
   - Configure Paddle environment
   - Set up webhook endpoints
   - Create product catalog in Paddle

### Phase 2: Backend Integration
3. **Subscription Management API**
   - User tier detection functions
   - Usage limit enforcement
   - Paddle webhook processing

4. **Feature Gating System**
   - Middleware for checking user limits
   - Secret creation/modification restrictions
   - Recipient limit enforcement

### Phase 3: Frontend Implementation
5. **Pricing & Subscription UI**
   - Pricing page with Paddle.js integration
   - Subscription management dashboard
   - Usage indicators throughout app

6. **User Experience Enhancement**
   - Upgrade prompts and CTAs
   - Payment success/failure flows
   - Billing history display

### Phase 4: Testing & Refinement
7. **End-to-End Testing**
   - Subscription lifecycle testing
   - Payment flow validation
   - Feature gating verification

8. **Performance Optimization**
   - Usage tracking optimization
   - Caching implementation
   - Database query optimization

## 🔢 DETAILED IMPLEMENTATION STEPS

### 1. Database Schema Implementation

```sql
-- User subscription tiers
CREATE TABLE user_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL CHECK (tier_name IN ('free', 'pro')),
  max_secrets INTEGER NOT NULL,
  max_recipients_per_secret INTEGER NOT NULL,
  custom_intervals BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User subscriptions from Paddle
CREATE TABLE user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_subscription_id TEXT UNIQUE,
  paddle_customer_id TEXT,
  status TEXT NOT NULL,
  tier_name TEXT NOT NULL CHECK (tier_name IN ('free', 'pro')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage tracking
CREATE TABLE subscription_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  secrets_count INTEGER DEFAULT 0,
  total_recipients INTEGER DEFAULT 0,
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Paddle Integration Configuration

**Environment Variables:**
```env
PADDLE_API_KEY=your_api_key
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=your_client_token
PADDLE_NOTIFICATION_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_PADDLE_ENV=sandbox # or production
```

**Product Catalog Setup:**
- Free Tier: $0/month (for consistency)
- Pro Tier: $19.99/month or $199/year

### 3. Backend Functions

**Tier Detection Function:**
```typescript
export async function getUserTier(userId: string): Promise<UserTier> {
  // Check active subscription
  // Return tier with limits and capabilities
  // Cache result for performance
}
```

**Usage Enforcement Middleware:**
```typescript
export async function enforceSecretLimit(userId: string): Promise<boolean> {
  // Check current usage against tier limits
  // Block creation if limit exceeded
  // Return upgrade suggestions
}
```

**Paddle Webhook Handler:**
```typescript
export async function handlePaddleWebhook(request: Request) {
  // Verify webhook signature
  // Process subscription events
  // Update user tier and status
  // Handle payment failures
}
```

### 4. Frontend Components

**Pricing Page Component:**
```typescript
// components/pricing/PricingPage.tsx
export function PricingPage() {
  // Paddle.js integration
  // Tier comparison display
  // Upgrade/downgrade flows
}
```

**Usage Indicator Component:**
```typescript
// components/subscription/UsageIndicator.tsx
export function UsageIndicator() {
  // Show current usage vs limits
  // Progress bars and warnings
  // Upgrade prompts when near limits
}
```

**Subscription Management:**
```typescript
// components/subscription/SubscriptionManager.tsx
export function SubscriptionManager() {
  // Current plan display
  // Payment method management
  // Billing history
  // Cancel/modify subscription
}
```

## 🔄 DEPENDENCIES & INTEGRATION POINTS

### External Dependencies
- **Paddle.js:** Frontend payment integration
- **Paddle API:** Backend subscription management
- **Supabase:** Database and authentication
- **Next.js:** App router and API routes

### Internal Dependencies
- **Existing Secret Management:** Must respect new limits
- **User Authentication:** Tie subscriptions to user accounts
- **Email System:** Billing notifications and receipts
- **Dashboard:** Display subscription status

## ⚠️ CHALLENGES & MITIGATIONS

### Technical Challenges
1. **Webhook Reliability**
   - Challenge: Network failures, duplicate events
   - Mitigation: Idempotent webhook processing, retry logic

2. **Usage Tracking Accuracy**
   - Challenge: Real-time limit enforcement
   - Mitigation: Cached usage with periodic refresh

3. **Payment Flow Security**
   - Challenge: Secure payment processing
   - Mitigation: Paddle handles PCI compliance, verify all webhooks

### Business Logic Challenges
1. **Grandfathering Existing Users**
   - Challenge: Users exceeding free tier limits
   - Mitigation: Grace period with upgrade prompts

2. **Failed Payment Handling**
   - Challenge: Subscription downgrades
   - Mitigation: Dunning management with Paddle Retain

3. **Prorated Billing**
   - Challenge: Mid-cycle upgrades/downgrades
   - Mitigation: Paddle handles proration automatically

## ✅ VERIFICATION CHECKLIST

### Technical Verification
- [ ] Database schema supports all tier requirements
- [ ] Paddle integration handles all subscription events
- [ ] Feature gating works correctly across all limits
- [ ] Webhook processing is reliable and secure
- [ ] Payment flows work end-to-end

### Business Verification
- [ ] Pricing aligns with feature value proposition
- [ ] Upgrade flows are intuitive and effective
- [ ] Usage indicators help users understand limits
- [ ] Billing and subscription management is complete
- [ ] Support processes handle billing issues

### Security Verification
- [ ] Webhook signatures are properly verified
- [ ] Payment data never stored inappropriately
- [ ] User subscription data is properly protected
- [ ] API keys and secrets are securely managed
- [ ] Rate limiting prevents API abuse

## 📊 SUCCESS METRICS

### Technical Metrics
- Webhook processing success rate (>99.5%)
- Payment flow completion rate (>95%)
- Feature gating accuracy (100%)
- Usage tracking latency (<500ms)

### Business Metrics
- Free to paid conversion rate (target: 5-10%)
- Monthly recurring revenue growth
- Customer lifetime value by tier
- Churn rate by payment method
