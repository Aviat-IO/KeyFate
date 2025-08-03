#!/usr/bin/env node

const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.development.local
const envPath = path.join(__dirname, '..', '.env.development.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      process.env[key.trim()] = value.trim();
    }
  });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

async function listStripeProducts() {
  console.log('🔍 Listing Stripe products and prices...\n');

  try {
    // List products
    const products = await stripe.products.list({ active: true });
    console.log('📦 Products:');
    products.data.forEach(product => {
      console.log(`  - ${product.name} (${product.id})`);
      if (product.description) {
        console.log(`    Description: ${product.description}`);
      }
    });

    console.log('\n💰 Prices:');
    const prices = await stripe.prices.list({ active: true });
    prices.data.forEach(price => {
      const amount = price.unit_amount / 100;
      const currency = price.currency.toUpperCase();
      const interval = price.recurring?.interval || 'one-time';
      const lookupKey = price.lookup_key || 'none';

      console.log(`  - ${price.id}`);
      console.log(`    Amount: ${amount} ${currency}`);
      console.log(`    Interval: ${interval}`);
      console.log(`    Lookup Key: ${lookupKey}`);
      console.log(`    Product: ${price.product}`);
      console.log('');
    });

    // Check for required lookup keys
    console.log('🔍 Checking for required lookup keys:');
    const requiredKeys = ['pro_monthly', 'pro_yearly'];
    const existingKeys = prices.data.map(p => p.lookup_key).filter(Boolean);

    requiredKeys.forEach(key => {
      if (existingKeys.includes(key)) {
        console.log(`  ✅ ${key} - Found`);
      } else {
        console.log(`  ❌ ${key} - Missing`);
      }
    });

  } catch (error) {
    console.error('❌ Error listing Stripe products:', error.message);
    process.exit(1);
  }
}

listStripeProducts();
