# Email Retry System Documentation

## Overview

The email retry system provides sophisticated retry logic with exponential backoff, failure classification, and dead letter queue management for email operations in the Dead Man's Switch application.

## Architecture

### Core Components

1. **EmailRetryService** (`/src/lib/email/email-retry-service.ts`)
   - Exponential backoff with jitter
   - Failure classification (transient vs permanent)
   - Configurable retry limits per email type
   - State persistence and tracking

2. **DeadLetterQueue** (`/src/lib/email/dead-letter-queue.ts`)
   - Failed email query interface
   - Manual retry capability
   - Batch retry operations
   - Cleanup and archival policies

3. **Admin API Endpoints** (`/src/app/api/admin/email-failures/`)
   - Query failed emails with filters
   - Manual retry single or batch
   - Mark failures as resolved
   - Statistics and monitoring

## Retry Configuration

### Retry Limits by Email Type

| Email Type          | Retry Limit | Priority  | Use Case                    |
| ------------------- | ----------- | --------- | --------------------------- |
| disclosure          | 5           | Critical  | Secret disclosure emails    |
| reminder            | 3           | Important | Check-in reminder emails    |
| verification        | 2           | Standard  | Email verification          |
| admin_notification  | 1           | Low       | Admin notification emails   |

### Exponential Backoff Algorithm

**Formula**: `delay = min(2^(attempt-1) * baseDelay, maxDelay) + jitter`

**Parameters**:
- Base Delay: 1000ms (1 second)
- Max Delay: 60000ms (1 minute)
- Jitter Factor: 50% of base delay

**Example Delays**:
- Attempt 1: 1000ms + jitter (1000-1500ms)
- Attempt 2: 2000ms + jitter (2000-3000ms)
- Attempt 3: 4000ms + jitter (4000-6000ms)
- Attempt 4: 8000ms + jitter (8000-12000ms)
- Attempt 5: 16000ms + jitter (16000-24000ms)

### Failure Classification

#### Transient Failures (Will Retry)
- Network timeouts
- Rate limiting (429, 503)
- Service unavailable (502, 503, 504)
- Connection errors (ECONNREFUSED, ETIMEDOUT)
- Socket errors

#### Permanent Failures (No Retry)
- Invalid email address
- Domain not found
- Authentication errors (401, 403)
- Blocked recipient
- Mailbox not found

## Usage

### Basic Retry Operation

```typescript
import { EmailRetryService } from '@/lib/email/email-retry-service';

const retryService = new EmailRetryService();

// Retry a failed email
const result = await retryService.retryFailure(
  failureId,
  async () => {
    // Your email send operation
    return await sendEmail(...);
  }
);

if (result.success) {
  console.log('Email sent successfully');
} else if (result.permanent) {
  console.log('Permanent failure - not retrying');
} else if (result.exhausted) {
  console.log('Retry limit exceeded');
} else {
  console.log(`Retry failed, next attempt at: ${result.nextRetryAt}`);
}
```

### Dead Letter Queue Management

```typescript
import { DeadLetterQueue } from '@/lib/email/dead-letter-queue';

const dlq = new DeadLetterQueue();

// Query failed emails
const failures = await dlq.queryFailures({
  emailType: 'disclosure',
  unresolvedOnly: true,
  limit: 50
});

// Manual retry
const result = await dlq.manualRetry(failureId, retryOperation);

// Batch retry
const results = await dlq.batchRetry(
  ['id1', 'id2', 'id3'],
  retryOperationFactory
);

// Mark as resolved
await dlq.markResolved(failureId);

// Cleanup old failures
await dlq.cleanup(30); // 30 days retention
```

### Admin API Endpoints

#### Query Failed Emails

```bash
GET /api/admin/email-failures?emailType=disclosure&unresolvedOnly=true&limit=50
```

Response:
```json
{
  "failures": [...],
  "count": 10,
  "limit": 50,
  "offset": 0
}
```

#### Get Statistics

```bash
GET /api/admin/email-failures?stats=true
```

Response:
```json
{
  "total": 150,
  "unresolved": 25,
  "permanent": 5,
  "exhausted": 10,
  "byType": {
    "disclosure": 50,
    "reminder": 80,
    "verification": 20
  },
  "byProvider": {
    "sendgrid": 100,
    "console-dev": 50
  }
}
```

#### Manual Retry Single Email

```bash
POST /api/admin/email-failures/:id/retry
```

Response:
```json
{
  "success": true,
  "error": null,
  "exhausted": false,
  "permanent": false
}
```

#### Batch Retry

```bash
POST /api/admin/email-failures/batch-retry
Content-Type: application/json

{
  "failureIds": ["id1", "id2", "id3"]
}
```

Response:
```json
{
  "total": 3,
  "successful": 2,
  "failed": 1,
  "errors": [
    { "id": "id3", "error": "Permanent failure" }
  ]
}
```

#### Mark as Resolved

```bash
DELETE /api/admin/email-failures/:id
```

Response:
```json
{
  "success": true,
  "failure": {
    "id": "abc123",
    "emailType": "reminder",
    "recipient": "user@example.com",
    "resolvedAt": "2025-01-04T18:00:00.000Z"
  }
}
```

## Integration with Cron Jobs

### Process Reminders (`/api/cron/process-reminders`)

The process-reminders cron job uses the enhanced retry service:

```typescript
import { calculateBackoffDelay } from '@/lib/email/email-retry-service';

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = calculateBackoffDelay(attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Check Secrets (`/api/cron/check-secrets`)

Similar integration with retry service for check-in reminder emails.

## Database Schema

### email_failures Table

```sql
CREATE TABLE email_failures (
  id UUID PRIMARY KEY,
  email_type VARCHAR NOT NULL,  -- 'reminder' | 'disclosure' | 'admin_notification' | 'verification'
  provider VARCHAR NOT NULL,    -- 'sendgrid' | 'console-dev' | 'resend'
  recipient VARCHAR NOT NULL,
  subject VARCHAR NOT NULL,
  error_message TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);
```

## Monitoring and Alerting

### Key Metrics

1. **Retry Success Rate**: Percentage of failures successfully retried
2. **Permanent Failure Rate**: Percentage of failures classified as permanent
3. **Retry Exhaustion Rate**: Percentage of failures hitting retry limit
4. **Average Retry Attempts**: Average attempts before success or exhaustion

### Admin Dashboard Integration

The dead letter queue provides statistics for admin dashboards:

```typescript
const stats = await dlq.getStats();

// Display:
// - Total failures
// - Unresolved count
// - Permanent failure count
// - Exhausted retry count
// - Breakdown by email type
// - Breakdown by provider
```

## Best Practices

1. **Monitor Failure Patterns**: Regularly review dead letter queue for systemic issues
2. **Clean Up Resolved Failures**: Run cleanup periodically to maintain performance
3. **Review Permanent Failures**: Investigate permanent failures for configuration issues
4. **Set Up Alerts**: Alert on high failure rates or exhausted retries
5. **Test Retry Logic**: Validate retry behavior in staging environments

## Testing

Comprehensive test suite in `__tests__/lib/email/email-retry.test.ts`:

- Exponential backoff timing validation
- Jitter randomization verification
- Failure classification accuracy
- Retry limit enforcement
- Dead letter queue operations
- State persistence validation

Run tests:
```bash
npm test -- __tests__/lib/email/email-retry.test.ts
```

## Future Enhancements

1. **Automatic Retry Scheduling**: Background job to retry eligible failures
2. **Advanced Analytics**: Detailed failure analysis and reporting
3. **Email Template Storage**: Store original email context for accurate retries
4. **Webhook Notifications**: Alert external systems of critical failures
5. **Rate Limit Coordination**: Coordinate retries to respect provider rate limits

## Security Considerations

1. **Admin Authorization**: All admin endpoints require authentication
2. **Rate Limiting**: Batch retry limited to 100 failures at once
3. **Data Privacy**: Email content not stored in failure records
4. **Audit Logging**: All manual retry actions should be logged
5. **Access Control**: Restrict dead letter queue access to authorized admins

## Performance Considerations

1. **Database Indexing**: Index on `email_type`, `resolved_at`, `created_at`
2. **Cleanup Schedule**: Run cleanup during low-traffic periods
3. **Batch Size**: Limit query results to prevent memory issues
4. **Retry Throttling**: Respect email provider rate limits

## Support and Troubleshooting

### Common Issues

**High Permanent Failure Rate**
- Check email validation logic
- Verify recipient email addresses
- Review provider configuration

**Retry Exhaustion**
- Increase retry limits if appropriate
- Investigate transient failure patterns
- Check provider status

**Slow Retry Performance**
- Review backoff timing
- Check database query performance
- Optimize retry operation

### Debugging

Enable verbose logging:
```typescript
console.log('[EmailRetryService] Retry attempt:', {
  failureId,
  attempt,
  delay,
  classification
});
```

Check failure logs:
```sql
SELECT * FROM email_failures
WHERE resolved_at IS NULL
ORDER BY created_at DESC
LIMIT 10;
```
