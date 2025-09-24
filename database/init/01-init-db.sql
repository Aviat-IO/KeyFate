-- Database initialization script
-- This runs when the PostgreSQL container starts for the first time

-- Create the application database if it doesn't exist
SELECT 'CREATE DATABASE keyfate_dev'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keyfate_dev')\gexec

-- Connect to the application database
\c keyfate_dev;

-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create initial schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS auth;

-- Grant necessary permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA auth TO postgres;

-- Set up row level security
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO postgres;

-- Log initialization complete
INSERT INTO pg_stat_statements_info (query, calls) VALUES ('Database initialized successfully', 1)
ON CONFLICT DO NOTHING;