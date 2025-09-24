# Cloud SQL Security Configuration

## Security Checklist

### ✅ Completed Security Measures

#### Database Instance Security
- [x] **SSL/TLS Encryption Required**: All connections must use SSL
- [x] **Server SSL Certificate**: Created for secure client connections
- [x] **Network Access Control**: Authorized networks configuration
- [x] **Security Logging**: Connection and statement logging enabled

#### User Authentication & Authorization
- [x] **Role-Based Access Control**: Separate roles for app, backup, and read-only access
- [x] **Principle of Least Privilege**: Each user has minimal required permissions
- [x] **Strong Password Policy**: Generated secure passwords for all database users
- [x] **Row Level Security (RLS)**: Enabled on sensitive tables for user data isolation

#### Database Security Features
- [x] **Performance Indexes**: Created for secure and efficient queries
- [x] **Default Data**: Subscription tiers pre-populated
- [x] **User Context Function**: Secure function for setting user context
- [x] **Public Schema Protection**: Revoked public access to prevent unauthorized access

#### Backup & Monitoring
- [x] **Automated Backups**: Configured with point-in-time recovery
- [x] **Audit Logging**: Cloud SQL audit logs enabled
- [x] **Security Monitoring**: Database activity logging configured

## Database Users & Roles

### Application User (`keyfate_app`)
- **Purpose**: Main application database operations
- **Permissions**: CRUD operations on all application tables
- **Security**: Subject to RLS policies, can set user context

### Backup User (`keyfate_backup`)
- **Purpose**: Database backups and maintenance
- **Permissions**: Read-only access to all tables
- **Security**: Cannot modify data, separate from application user

### Read-Only User (`keyfate_readonly`)
- **Purpose**: Analytics, reporting, and monitoring
- **Permissions**: SELECT only on all tables
- **Security**: No write permissions, safe for external tools

## Security Policies

### Row Level Security (RLS)
Tables with user isolation:
- `secrets`: Users can only access their own secrets
- `checkin_history`: Users can only see their own check-in history
- `user_contact_methods`: Users can only manage their own contact methods
- `user_subscriptions`: Users can only access their own subscription data

### Network Security
- **Production**: Use private IP and VPC peering
- **Development**: Authorized networks with specific IP ranges
- **SSL/TLS**: Required for all connections

### Password Management
- **Generation**: Cryptographically secure random passwords
- **Storage**: Use Google Secret Manager for production
- **Rotation**: Regular password rotation recommended

## Production Security Recommendations

### Network Configuration
1. **Private IP**: Use private IP instead of public IP
2. **VPC Peering**: Configure VPC peering for secure access
3. **Firewall Rules**: Implement strict firewall rules
4. **VPN Access**: Use VPN for administrative access

### Authentication Enhancements
1. **IAM Database Authentication**: Use Google Cloud IAM where possible
2. **Certificate-Based Auth**: Implement client certificate authentication
3. **Multi-Factor Authentication**: Require MFA for database admin access

### Monitoring & Alerting
1. **Connection Monitoring**: Alert on unusual connection patterns
2. **Query Monitoring**: Monitor for suspicious or expensive queries
3. **Failed Login Alerts**: Alert on authentication failures
4. **Performance Monitoring**: Track database performance metrics

### Compliance & Governance
1. **Data Encryption**: Ensure encryption at rest and in transit
2. **Access Auditing**: Regular access reviews and audits
3. **Vulnerability Scanning**: Regular security assessments
4. **Backup Testing**: Regular backup restore testing

## Security Commands

### Grant Database Permissions
```bash
# Run SQL permissions script
psql "postgresql://username:password@host:5432/keyfate?sslmode=require" -f scripts/sql/setup-permissions.sql
```

### Configure Security Settings
```bash
# Run security configuration script
./scripts/configure-cloud-sql-security.sh
```

### Test Security Configuration
```bash
# Test database connection with security validation
npm run db:test-security
```

### Store Secrets Securely
```bash
# Store database passwords in Google Secret Manager
gcloud secrets create backup-db-password --data-file=<(echo 'BACKUP_PASSWORD')
gcloud secrets create readonly-db-password --data-file=<(echo 'READONLY_PASSWORD')
```

## Security Incident Response

### Suspected Breach
1. **Immediate Actions**:
   - Disable compromised user accounts
   - Review audit logs for suspicious activity
   - Check for data exfiltration

2. **Investigation**:
   - Analyze connection logs
   - Review query patterns
   - Check authorized networks

3. **Recovery**:
   - Rotate all database passwords
   - Update authorized networks
   - Review and update security policies

### Regular Security Tasks
- **Weekly**: Review connection logs
- **Monthly**: Rotate database passwords
- **Quarterly**: Security assessment and penetration testing
- **Yearly**: Full security audit and compliance review

## Contact Information

For security issues or questions:
- **Security Team**: security@keyfate.com
- **DBA Team**: dba@keyfate.com
- **Emergency**: Follow incident response procedures