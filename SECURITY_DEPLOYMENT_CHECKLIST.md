# Production Security Deployment Checklist

## Pre-Deployment Verification

### 1. Database ✅

- [x] Migration `0018_production_security_hardening.sql` applied in staging
- [x] Migration applied in production
- [x] Verify `webhook_events` table exists with unique constraint
- [x] Verify `privacy_policy_acceptance` table exists
- [x] Composite index on `secrets(userId, status)` created

### 2. Environment Variables

- [ ] `NEXTAUTH_SECRET` - Strong random secret (min 32 chars)
- [ ] `CRON_SECRET` - Strong random secret for HMAC signing
- [ ] `ADMIN_TOKEN` - Strong random token (no fallback)
- [ ] `ENCRYPTION_KEY` - Valid 32-byte base64 encoded key
- [ ] `DATABASE_URL` - Production database connection string
- [ ] `SENDGRID_API_KEY` - Production SendGrid API key
- [ ] `SENDGRID_ADMIN_EMAIL` - Admin notification email
- [ ] `NEXTAUTH_URL` - Production URL (<https://staging.keyfate.com>)
- [ ] `CLOUDSQL_AUTHORIZED_NETWORKS` - Production IPs for admin access
- [ ] Optional: `SENTRY_DSN` for error tracking

### 3. Security Features

- [x] CSRF protection enabled for critical endpoints
- [x] Re-authentication for server share reveal
- [x] HMAC authentication for cron jobs
- [x] Webhook replay protection (Stripe + BTCPay)
- [x] 8-digit OTP with 5-minute expiration
- [x] 24-hour session timeout
- [x] Admin IP whitelisting (uses Cloud SQL authorized networks)
- [x] Rate limiting (secrets: 5/hr, check-in: 10/hr)
- [x] Email verification enforcement
- [x] Sensitive data sanitization in logs

## Deployment Steps

### Phase 1: Staging Validation (Completed ✅)

1. [x] Deploy to staging environment
2. [x] Run database migration
3. [x] Verify environment variables configured
4. [x] Run startup validation script
5. [x] Verify health checks pass

### Phase 2: Functional Testing

1. [x] Test OTP flow (8-digit, 5-minute expiration)
2. [x] Test email verification enforcement
3. [x] Test CSRF protection
   - [x] Try creating secret from different origin (should fail)
   - [x] Create secret from same origin (should succeed)
4. [ ] Test re-authentication for server share
   - [ ] Try accessing without re-auth token (should fail with REAUTH_REQUIRED)
   - [x] Access with valid OTP token (should succeed)
5. [ ] Test webhook replay protection
   - [ ] Send duplicate Stripe webhook (should return 200, not process twice)
   - [ ] Send duplicate BTCPay webhook (should return 200, not process twice)
6. [ ] Test cron authentication
   - [ ] Try calling cron without auth (should fail)
   - [ ] Call with valid HMAC signature (should succeed)
   - [ ] Try replaying old HMAC signature (should fail)
7. [ ] Test rate limiting
   - [x] Create 6 secrets in quick succession (6th should be rate limited)
   - [ ] Make 11 check-ins in quick succession (11th should be rate limited)
8. [ ] Test admin IP whitelisting
   - [ ] Access admin endpoints from non-whitelisted IP (should fail)
   - [ ] Access from whitelisted IP (should succeed)

### Phase 3: Security Audit

1. [ ] Run OWASP ZAP scan against staging
   - [ ] Address any high-severity findings
   - [ ] Document medium/low findings for review
2. [ ] Review application logs for sensitive data leaks
3. [ ] Verify no hardcoded secrets in code
4. [ ] Check rate limit thresholds are appropriate
5. [ ] Verify CSRF protection doesn't block legitimate requests

### Phase 4: Load Testing

1. [ ] Test with 100 concurrent users
2. [ ] Test cron job with 1,000 secrets
3. [ ] Verify database connection pool handles load
4. [ ] Monitor response times (<500ms p95)
5. [ ] Verify rate limiting doesn't block legitimate traffic

### Phase 5: Production Deployment

1. [ ] Create rollback plan
2. [ ] Schedule deployment during low-traffic window
3. [ ] Deploy application
4. [ ] Run database migration (if not already applied)
5. [ ] Verify environment variables in production
6. [ ] Run startup validation
7. [ ] Monitor health check endpoint
8. [ ] Test critical flows:
   - [ ] User signup with email verification
   - [ ] Secret creation
   - [ ] Check-in
   - [ ] Payment webhook

### Phase 6: Post-Deployment Monitoring

1. [ ] Monitor error rates (Sentry if configured)
2. [ ] Monitor rate limit hits
3. [ ] Monitor webhook processing success rate
4. [ ] Check admin email for failure notifications
5. [ ] Review logs for any security warnings
6. [ ] Monitor database connection pool metrics

## Security Feature Testing

### CSRF Protection

```bash
# Test: Create secret from wrong origin (should fail with 403)
curl -X POST https://staging.keyfate.com/api/secrets \
  -H "Content-Type: application/json" \
  -H "Origin: http://evil-site.com" \
  -H "Host: staging.keyfate.com" \
  -d '{"title":"test","check_in_days":7,"recipients":[{"name":"Test","email":"test@example.com"}]}'

# Expected: {"error":"CSRF validation failed","message":"Request origin validation failed"}
```

### Re-Authentication

```bash
# Test: Access server share without re-auth (should fail with 403)
curl -X POST https://staging.keyfate.com/api/secrets/SECRET_ID/reveal-server-share \
  -H "Content-Type: application/json" \
  -H "Origin: https://staging.keyfate.com" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"

# Expected: {"error":"Re-authentication required","code":"REAUTH_REQUIRED"}
```

### Cron HMAC Authentication

```bash
# Generate HMAC signature
TIMESTAMP=$(date +%s000)
URL="https://staging.keyfate.com/api/cron/check-secrets"
MESSAGE="${TIMESTAMP}.${URL}"
SIGNATURE=$(echo -n "$MESSAGE" | openssl dgst -sha256 -hmac "$CRON_SECRET" | awk '{print $2}')

# Test: Call cron with valid HMAC
curl -X POST $URL \
  -H "x-cron-signature: $SIGNATURE" \
  -H "x-cron-timestamp: $TIMESTAMP"

# Expected: Success response from cron job
```

### Webhook Replay Protection

```bash
# Test: Send same Stripe webhook twice
# First request should succeed, second should return 200 but not process

curl -X POST https://staging.keyfate.com/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: VALID_SIGNATURE" \
  -d '{"id":"evt_test_123","type":"checkout.session.completed",...}'

# Send again with same event ID
# Expected: 200 OK, but subscription not created twice
```

## Rollback Procedure

If critical issues are detected:

1. **Immediate Actions:**
   - Revert to previous deployment
   - Disable problematic features via feature flags (if available)
   - Alert team via incident channel

2. **Database Rollback:**
   - If migration causes issues, run rollback script
   - Backup database before rollback
   - Verify data integrity after rollback

3. **Communication:**
   - Notify users of any service disruption
   - Update status page
   - Document root cause for postmortem

## Success Criteria

Deployment is considered successful when:

- [x] All environment variables validated
- [x] Database migration applied successfully
- [ ] Health checks return 200 OK
- [ ] All critical user flows work end-to-end
- [ ] No spike in error rates (< 1% error rate)
- [ ] Response times within acceptable range (<500ms p95)
- [ ] Rate limiting not blocking legitimate users
- [ ] CSRF protection not blocking legitimate requests
- [ ] No sensitive data in logs
- [ ] Admin endpoints only accessible from whitelisted IPs

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Error Rates:**
   - Overall error rate < 1%
   - 401/403 errors (authentication/authorization)
   - 429 errors (rate limiting)

2. **Performance:**
   - API response times (p50, p95, p99)
   - Database connection pool utilization
   - Memory and CPU usage

3. **Security:**
   - Failed authentication attempts
   - CSRF validation failures
   - Rate limit hits per endpoint
   - Admin access attempts from non-whitelisted IPs
   - Webhook replay detections

### Alert Thresholds

- Error rate > 5% for 5 minutes → Page on-call
- Response time p95 > 1s for 10 minutes → Alert team
- Failed auth attempts > 100/min → Security alert
- Database connections > 90% → Scale alert

## Known Issues & Limitations

1. **Frontend Re-Auth UI:**
   - Backend implemented, frontend modal UI pending
   - Users will get API error until UI built

2. **CSRF on All Endpoints:**
   - Protected: secrets, payments, server shares
   - Pending: Some admin endpoints, user profile updates

3. **Rate Limiting:**
   - Using in-memory LRU cache (single server)
   - For multi-server, migrate to Redis

4. **Sentry APM:**
   - Logger has Sentry integration
   - Sentry project not yet created
   - Set SENTRY_DSN when ready

## Next Steps

1. **High Priority:**
   - Build frontend re-authentication modal UI
   - Add CSRF to remaining authenticated endpoints
   - Set up Sentry APM for error tracking
   - Complete integration test suite

2. **Medium Priority:**
   - Privacy policy acceptance UI
   - GDPR data export/deletion endpoints
   - Migrate rate limiting to Redis (for multi-server)
   - Set up monitoring dashboards

3. **Low Priority:**
   - Webhook cleanup cron job (30-day retention)
   - Security audit documentation
   - Penetration testing

## Sign-Off

- [ ] Tech Lead Review
- [ ] Security Team Review
- [ ] QA Approval
- [ ] Product Owner Approval
- [ ] Ready for Production Deployment

---

**Last Updated:** $(date) **Version:** 1.0 **Change ID:**
harden-production-security
