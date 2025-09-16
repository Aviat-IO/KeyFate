# BTCPay Server Database Setup

BTCPay Server requires its own dedicated database to avoid conflicts with your main application schema.

## Option 1: Create Database via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run this command to create a dedicated database for BTCPay Server:

```sql
CREATE DATABASE btcpayserver;
```

## Option 2: Create Database via psql

If you have direct PostgreSQL access:

```bash
# Connect to your Supabase PostgreSQL instance
psql "postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres"

# Create the BTCPay Server database
CREATE DATABASE btcpayserver;

# Grant permissions to your user
GRANT ALL PRIVILEGES ON DATABASE btcpayserver TO postgres;
```

## Connection String Format

BTCPay Server expects the PostgreSQL connection string in .NET format:

```
User ID=postgres;Password=your-password;Host=db.your-project.supabase.co;Port=5432;Database=btcpayserver;SSL Mode=Require
```

**Important Notes:**

1. **Separate Database**: BTCPay Server should use its own database (`btcpayserver`) instead of sharing the main `postgres` database with your application
2. **SSL Required**: Supabase requires SSL connections, so `SSL Mode=Require` is necessary
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
BTCPAY_POSTGRES=User ID=postgres;Password=your-password;Host=db.your-project.supabase.co;Port=5432;Database=btcpayserver;SSL Mode=Require
```

For production (terraform.tfvars):
```hcl
btcpay_db_connection = "User ID=postgres;Password=your-password;Host=db.your-project.supabase.co;Port=5432;Database=btcpayserver;SSL Mode=Require"
```
