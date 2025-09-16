-- BTCPay Server Database Setup
-- Run this in your Supabase SQL Editor to create the BTCPay Server database

-- Step 1: Create the BTCPay Server database
-- Note: This must be run by a user with CREATEDB privileges
CREATE DATABASE btcpayserver;

-- Step 2: Grant permissions to the postgres user
GRANT ALL PRIVILEGES ON DATABASE btcpayserver TO postgres;

-- Step 3: Verify the database was created successfully
-- Switch to the btcpayserver database and run this:
-- SELECT 'BTCPay Server database created successfully!' as status, version();

-- Next Steps:
-- 1. Update your terraform.tfvars with:
--    btcpay_db_connection = "User ID=postgres;Password=YOUR_PASSWORD;Host=YOUR_HOST;Port=5432;Database=btcpayserver;SSL Mode=Require"
-- 2. Deploy BTCPay Server using: terragrunt apply
