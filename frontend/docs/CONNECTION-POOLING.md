# Connection Pooling Configuration

## Overview

Connection pooling is implemented at multiple levels to optimize database performance and resource utilization:

1. **Application-level pooling** (postgres-js)
2. **External pooling** (PgBouncer)
3. **Cloud SQL built-in pooling**

## Application-Level Pooling

### Configuration

The application uses postgres-js with enhanced connection pooling:

```typescript
// Connection pool settings
max: 20,           // Maximum connections in pool
min: 5,            // Minimum connections to maintain
idle_timeout: 600, // 10 minutes before closing idle connections
connect_timeout: 15, // 15 seconds to establish connection
```

### Environment Variables

```bash
# Connection pool configuration
DB_POOL_MAX=20                    # Maximum connections (default: 20)
DB_POOL_MIN=5                     # Minimum connections (default: 5)
DB_IDLE_TIMEOUT=600               # Idle timeout in seconds (default: 600)
DB_CONNECT_TIMEOUT=15             # Connection timeout in seconds (default: 15)
DB_STATEMENT_TIMEOUT=30000        # Statement timeout in milliseconds (default: 30000)
DB_DEBUG=false                    # Enable debug logging (default: false)
```

### Pool Monitoring

```typescript
import { getConnectionPoolStats, checkDatabaseConnectionHealth } from '@/lib/db/connection';

// Get current pool statistics
const stats = getConnectionPoolStats();
console.log('Active connections:', stats.activeConnections);
console.log('Idle connections:', stats.idleConnections);

// Comprehensive health check
const health = await checkDatabaseConnectionHealth();
console.log('Database healthy:', health.isHealthy);
console.log('Response time:', health.responseTime + 'ms');
```

## External Pooling with PgBouncer

### Docker Deployment

```bash
# Start PgBouncer with Docker Compose
docker-compose -f docker-compose.pooling.yml up -d

# Check PgBouncer status
docker logs keyfate-pgbouncer
```

### Configuration

PgBouncer is configured with:
- **Pool mode**: Transaction-level pooling
- **Max client connections**: 100
- **Default pool size**: 20
- **Connection lifecycle**: Optimized for transaction efficiency

### Environment Variables for PgBouncer

```bash
# Database connection details
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=keyfate  # Note: Both staging and prod use 'keyfate' database
DB_USER=keyfate_app
DB_PASSWORD=your_secure_password

# Cloud SQL Proxy (for local development)
CLOUD_SQL_CONNECTION_NAME=project:region:instance
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

## Production Deployment

### Without PgBouncer (Recommended for small scale)

```bash
# Direct connection to Cloud SQL
# Note: Both staging and prod use the same 'keyfate' database name
DATABASE_URL="postgresql://user:pass@cloud-sql-ip:5432/keyfate?sslmode=require"
```

### With PgBouncer (Recommended for high traffic)

```bash
# Connection through PgBouncer
DATABASE_URL="postgresql://user:pass@pgbouncer-host:6432/keyfate"
```

### Cloud SQL Proxy (For local development)

```bash
# Start Cloud SQL Proxy
./cloud_sql_proxy project:region:instance --port 5432

# Connect via proxy
DATABASE_URL="postgresql://user:pass@127.0.0.1:5432/keyfate"
```

## Performance Optimization

### Pool Sizing Guidelines

| Environment | App Pool Size | PgBouncer Pool | Total Connections |
|-------------|---------------|----------------|-------------------|
| Development | 5-10          | N/A            | 5-10              |
| Staging     | 10-20         | 20-30          | 30-50             |
| Production  | 20-50         | 50-100         | 70-150            |

### Monitoring Metrics

#### Application Metrics
- Active connections
- Idle connections
- Connection acquisition time
- Query execution time

#### PgBouncer Metrics
- Pool utilization
- Wait time
- Connection errors
- Transaction throughput

#### Cloud SQL Metrics
- CPU utilization
- Memory usage
- Connection count
- Query performance

## Troubleshooting

### Common Issues

#### Too Many Connections
```
Error: remaining connection slots are reserved for non-replication superuser connections
```

**Solutions**:
1. Reduce application pool size
2. Implement PgBouncer
3. Upgrade Cloud SQL instance

#### Connection Timeouts
```
Error: connect ETIMEDOUT
```

**Solutions**:
1. Increase `connect_timeout`
2. Check network connectivity
3. Verify Cloud SQL authorized networks

#### Pool Exhaustion
```
Error: Connection pool exhausted
```

**Solutions**:
1. Increase pool size
2. Reduce connection hold time
3. Implement connection retry logic

### Health Check Endpoints

#### Application Health
```typescript
// Add to your API routes
export async function GET() {
  const health = await checkDatabaseConnectionHealth();

  return Response.json({
    status: health.isHealthy ? 'healthy' : 'unhealthy',
    database: {
      responseTime: health.responseTime,
      poolStats: health.poolStats,
    }
  });
}
```

#### PgBouncer Health
```bash
# Check PgBouncer stats
psql "host=pgbouncer-host port=6432 dbname=pgbouncer user=admin" -c "SHOW STATS;"
```

## Best Practices

### Application Code
1. **Always close connections**: Use try/finally blocks
2. **Connection timeouts**: Set reasonable timeouts
3. **Error handling**: Implement retry logic
4. **Monitoring**: Track pool statistics

### Pool Configuration
1. **Size appropriately**: Don't over-provision
2. **Monitor actively**: Track utilization
3. **Test under load**: Validate configuration
4. **Plan for scale**: Design for growth

### Security
1. **Secure credentials**: Use environment variables
2. **Network isolation**: Use private IPs when possible
3. **SSL/TLS**: Always encrypt connections
4. **Access control**: Limit connection sources

## Deployment Scripts

### Local Development
```bash
# Start development stack with pooling
npm run dev:with-pooling

# Run without pooling
npm run dev
```

### Production Deployment
```bash
# Deploy with PgBouncer
docker-compose -f docker-compose.production.yml up -d

# Deploy application only
npm run build && npm run start
```

### Testing
```bash
# Test connection pooling
npm run test:db-pool

# Load test with pooling
npm run test:load
```

## Configuration Files

- `pgbouncer.ini`: PgBouncer configuration
- `docker-compose.pooling.yml`: Docker setup with pooling
- `src/lib/db/connection.ts`: Application pool configuration