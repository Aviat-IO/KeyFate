## 1. Database Schema

- [x] 1.1 Create audit_logs table schema with fields: id, user_id, event_type, event_category, resource_type, resource_id, details (jsonb), ip_address, user_agent, created_at
- [x] 1.2 Create database migration for audit_logs table
- [x] 1.3 Add indexes for performance: user_id, event_type, created_at
- [x] 1.4 Create event_type enum: secret_created, secret_edited, secret_deleted, check_in, secret_triggered, recipient_added, recipient_removed, settings_changed, login, subscription_changed

## 2. Audit Logging Service

- [x] 2.1 Create `frontend/src/lib/services/audit-logger.ts` with log() function
- [x] 2.2 Implement helper functions: logSecretCreated, logSecretEdited, logCheckIn, etc.
- [x] 2.3 Add automatic context capture: user_id, timestamp, ip_address, user_agent
- [x] 2.4 Handle logging failures gracefully (log to error tracking, don't block operations)

## 3. Backend Integration

- [ ] 3.1 Add audit logging to secret creation endpoint
- [ ] 3.2 Add audit logging to secret update endpoint
- [ ] 3.3 Add audit logging to secret deletion endpoint
- [ ] 3.4 Add audit logging to check-in endpoint
- [ ] 3.5 Add audit logging to recipient management endpoints
- [ ] 3.6 Add audit logging to settings update endpoints
- [ ] 3.7 Add audit logging to NextAuth callbacks (login events)
- [ ] 3.8 Add audit logging to subscription webhook handlers

## 4. API Endpoints

- [ ] 4.1 Create GET /api/audit-logs with pagination, filtering, and Pro tier validation
- [ ] 4.2 Create GET /api/audit-logs/export for CSV/JSON export (Pro only)
- [ ] 4.3 Add tier validation middleware for audit log endpoints
- [ ] 4.4 Implement query filters: event_type, date_range, resource_id

## 5. Frontend UI

- [ ] 5.1 Create `AuditLogsPage.tsx` component with table view
- [ ] 5.2 Add pagination controls to audit log table
- [ ] 5.3 Add filters: event type, date range, search
- [ ] 5.4 Add export button (CSV/JSON download)
- [ ] 5.5 Add audit logs link to user dashboard/settings (Pro users only)
- [ ] 5.6 Show upgrade prompt for Free users attempting to access audit logs

## 6. Constants & Features

- [ ] 6.1 Add audit logs to PRO_FEATURES constant
- [ ] 6.2 Create audit event type constants for consistency
- [ ] 6.3 Update tiers.ts to include "Comprehensive audit logs" in Pro features

## 7. Testing

- [ ] 7.1 Test audit log creation for each event type
- [ ] 7.2 Test audit log retrieval with pagination
- [ ] 7.3 Test audit log filtering and search
- [ ] 7.4 Test audit log export (CSV/JSON)
- [ ] 7.5 Test Pro tier enforcement (Free users blocked)
- [ ] 7.6 Test logging doesn't break operations if it fails
- [ ] 7.7 Test audit log captures all required context (user, IP, timestamp)
- [ ] 7.8 Performance test: ensure logging doesn't slow down operations significantly

## 8. Documentation

- [ ] 8.1 Update project.md with audit logging feature details
- [ ] 8.2 Document audit event types and their meanings
- [ ] 8.3 Document audit log retention policy (indefinite)
