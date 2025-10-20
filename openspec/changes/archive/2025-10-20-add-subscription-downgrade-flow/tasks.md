# Implementation Tasks

## 1. Database Schema Updates
- [ ] 1.1 Add `scheduled_downgrade_at` timestamp field to `user_subscriptions` table
- [ ] 1.2 Create and test database migration
- [ ] 1.3 Update TypeScript types for UserSubscription

## 2. Subscription Service Tests (TDD - Write Tests First)
- [ ] 2.1 Write unit tests for `scheduleDowngrade()` method (both Stripe and BTCPay scenarios)
- [ ] 2.2 Write unit tests for `cancelScheduledDowngrade()` method
- [ ] 2.3 Write unit tests for edge cases (already scheduled, expired subscription, invalid tier)
- [ ] 2.4 Write integration tests for subscription state transitions

## 3. Subscription Service Implementation
- [ ] 3.1 Implement `scheduleDowngrade()` method in `subscription-service.ts`
- [ ] 3.2 Implement `cancelScheduledDowngrade()` method in `subscription-service.ts`
- [ ] 3.3 Add audit log events for downgrade scheduled/cancelled/executed
- [ ] 3.4 Verify all tests pass

## 4. Payment Provider Tests (TDD - Write Tests First)
- [ ] 4.1 Write tests for Stripe: `cancel_at_period_end` flag handling
- [ ] 4.2 Write tests for Stripe: webhook verification for cancelled subscription
- [ ] 4.3 Write tests for BTCPay: period end calculation
- [ ] 4.4 Write tests for BTCPay: downgrade scheduling logic

## 5. Payment Provider Implementation
- [ ] 5.1 Stripe: Implement `cancel_at_period_end` flag when scheduling downgrade
- [ ] 5.2 Stripe: Implement cancellation verification in webhook handler
- [ ] 5.3 BTCPay: Implement period end calculation based on payment date + duration
- [ ] 5.4 BTCPay: Implement period end date storage for downgrade scheduling
- [ ] 5.5 Verify all tests pass

## 6. API Endpoint Tests (TDD - Write Tests First)
- [ ] 6.1 Write tests for `POST /api/user/subscription/schedule-downgrade` (success, unauthorized, already scheduled)
- [ ] 6.2 Write tests for `POST /api/user/subscription/cancel-downgrade` (success, unauthorized, no scheduled downgrade)
- [ ] 6.3 Write tests for authentication/authorization checks
- [ ] 6.4 Write tests for error handling and validation

## 7. API Endpoint Implementation
- [ ] 7.1 Create `POST /api/user/subscription/schedule-downgrade` endpoint
- [ ] 7.2 Create `POST /api/user/subscription/cancel-downgrade` endpoint
- [ ] 7.3 Add authentication/authorization middleware
- [ ] 7.4 Add request validation
- [ ] 7.5 Verify all tests pass

## 8. Cron Job Tests (TDD - Write Tests First)
- [ ] 8.1 Write tests for cron job authentication (valid/invalid CRON_SECRET)
- [ ] 8.2 Write tests for processing eligible downgrades
- [ ] 8.3 Write tests for no eligible downgrades scenario
- [ ] 8.4 Write tests for partial failure handling (some succeed, some fail)
- [ ] 8.5 Write tests for email sending on downgrade execution
- [ ] 8.6 Write tests for audit log creation

## 9. Cron Job Implementation
- [ ] 9.1 Create `/api/cron/process-subscription-downgrades/route.ts`
- [ ] 9.2 Implement cron authentication using CRON_SECRET
- [ ] 9.3 Implement query for subscriptions with `scheduled_downgrade_at <= NOW()` and `status = 'active'`
- [ ] 9.4 Implement subscription tier update to free
- [ ] 9.5 Implement downgrade confirmation email sending
- [ ] 9.6 Implement audit log execution
- [ ] 9.7 Verify all tests pass

## 10. Settings UI Component Tests (TDD - Write Tests First)
- [ ] 10.1 Write tests for Settings layout and sidebar navigation
- [ ] 10.2 Write tests for `/settings/general` page (user info display)
- [ ] 10.3 Write tests for `/settings/subscription` page (Free user view)
- [ ] 10.4 Write tests for `/settings/subscription` page (Pro user view)
- [ ] 10.5 Write tests for `/settings/subscription` page (Pro user with scheduled downgrade)
- [ ] 10.6 Write tests for downgrade confirmation dialog
- [ ] 10.7 Write tests for cancel downgrade flow
- [ ] 10.8 Write tests for navbar Settings menu item

## 11. Settings UI Implementation
- [ ] 11.1 Install ShadCN sidebar component if not present
- [ ] 11.2 Create `/settings` layout with sidebar navigation
- [ ] 11.3 Create `/settings/general` page showing user info (name, email, join date)
- [ ] 11.4 Move `/audit-logs` page to `/settings/audit` (keep redirect from old URL)
- [ ] 11.5 Create `/settings/subscription` page with current plan display
- [ ] 11.6 Display upgrade button for free users (link to `/pricing`)
- [ ] 11.7 Display downgrade button for Pro users
- [ ] 11.8 Show "Downgrade scheduled for [date]" message if downgrade is pending
- [ ] 11.9 Add "Cancel downgrade" button if downgrade is scheduled
- [ ] 11.10 Add downgrade confirmation dialog component
- [ ] 11.11 Update navbar to add "Settings" dropdown menu item
- [ ] 11.12 Verify all tests pass

## 12. Integration Testing
- [ ] 12.1 Test complete Stripe downgrade flow end-to-end (schedule, execute via cron)
- [ ] 12.2 Test complete BTCPay downgrade flow end-to-end
- [ ] 12.3 Test downgrade cancellation flow end-to-end
- [ ] 12.4 Test UI navigation and sidebar on all settings pages
- [ ] 12.5 Test downgrade with active secrets (grandfathering behavior)
- [ ] 12.6 Test audit log entries for all downgrade events
- [ ] 12.7 Test email delivery for downgrade confirmation

## 13. Infrastructure & Deployment
- [ ] 13.1 Configure Google Cloud Scheduler job (daily run at 00:00 UTC)
- [ ] 13.2 Verify cron job authentication in Cloud environment
- [ ] 13.3 Set up monitoring/alerting for cron job failures

## 14. Documentation & Polish
- [ ] 14.1 Update user-facing documentation about downgrade process
- [ ] 14.2 Add tooltips/help text explaining downgrade behavior
- [ ] 14.3 Verify all error states have user-friendly messages
- [ ] 14.4 Run linting and type checking
- [ ] 14.5 Verify test coverage meets project standards
