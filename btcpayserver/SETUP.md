# BTCPay Server Database Setup

BTCPay Server requires its own dedicated database to avoid conflicts with your main application schema.

## Option 1: Local Development (Docker)

Create the database in your local PostgreSQL container:

```bash
# Connect to local PostgreSQL instance
docker exec -it dead-mans-switch-postgres-1 psql -U postgres

# Create the BTCPay Server database
CREATE DATABASE btcpayserver;
```

## Option 2: Production (Google Cloud SQL)

Create the database via Cloud SQL Admin or psql:

```bash
# Connect to your Cloud SQL PostgreSQL instance
psql "postgresql://postgres:your-password@your-cloudsql-instance:5432/postgres"

# Create the BTCPay Server database
CREATE DATABASE btcpayserver;

# Grant permissions to your user
GRANT ALL PRIVILEGES ON DATABASE btcpayserver TO postgres;
```

## Connection String Format

BTCPay Server expects the PostgreSQL connection string in .NET format:

### Local Development
```
User ID=postgres;Password=postgres;Host=localhost;Port=5432;Database=btcpayserver
```

### Production (Cloud SQL)
```
User ID=postgres;Password=your-password;Host=your-cloudsql-instance;Port=5432;Database=btcpayserver;SSL Mode=Require
```

**Important Notes:**

1. **Separate Database**: BTCPay Server should use its own database (`btcpayserver`) instead of sharing the main `postgres` database with your application
2. **SSL Required**: Production environments require SSL connections, so `SSL Mode=Require` is necessary
3. **Permissions**: Ensure the database user has full permissions to create/modify tables and schemas
4. **Migration**: BTCPay Server will automatically create its schema on first startup

## Troubleshooting

If you get migration errors:

1. **Check Database Exists**: Ensure the `btcpayserver` database exists
2. **Check Permissions**: Verify the user has CREATE/DROP permissions
3. **Clean Database**: If migrations fail, you may need to drop and recreate the database:
   ```sql
   DROP DATABASE IF EXISTS btcpayserver;
   CREATE DATABASE btcpayserver;
   ```

## Environment Variables

For local development (docker-compose):
```bash
BTCPAY_POSTGRES=User ID=postgres;Password=postgres;Host=localhost;Port=5432;Database=btcpayserver
```

For production (terraform.tfvars):
```hcl
btcpay_db_connection = "User ID=postgres;Password=your-password;Host=your-cloudsql-instance;Port=5432;Database=btcpayserver;SSL Mode=Require"
```
