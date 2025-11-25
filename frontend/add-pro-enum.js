#!/usr/bin/env node
const { Client } = require('pg');

const DB_URL = 'postgresql://keyfate_app:hM65ANes82sH%2BhAmtmmhMB9N5lo5JFQbEjZiDn1DCpk%3D@localhost:54321/keyfate'
  .replace('%2B', '+')
  .replace('%3D', '=');

async function main() {
  const client = new Client({ connectionString: DB_URL });
  
  try {
    console.log('Adding "pro" to subscription_tier enum...');
    await client.connect();
    
    await client.query(`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_enum 
              WHERE enumlabel = 'pro' 
              AND enumtypid = 'public.subscription_tier'::regtype
          ) THEN
              ALTER TYPE subscription_tier ADD VALUE 'pro';
              RAISE NOTICE 'Added "pro" to subscription_tier enum';
          ELSE
              RAISE NOTICE '"pro" already exists in subscription_tier enum';
          END IF;
      END $$;
    `);
    
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
