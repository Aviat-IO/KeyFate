-- Create a secure schema for extensions
create schema if not exists extensions;

-- Move pg_net to extensions schema
drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;

-- Revoke public access and grant specific access
revoke all on schema extensions from public;
grant usage on schema extensions to postgres, service_role; 
