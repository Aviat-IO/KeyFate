#!/usr/bin/env node

/**
 * Setup script for Stripe products and prices
 * Run this script to create the required products and prices in your Stripe account
 */

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

async function createProduct(name, description) {
  try {
    const product = await stripe.products.create({
      name,
      description,
      metadata: {
        keyfate_product: 'true',
      },
    });
    console.log(`✅ Created product: ${name} (${product.id})`);
    return product;
  } catch (error) {
    if (error.code === 'resource_already_exists') {
      console.log(`⚠️  Product already exists: ${name}`);
      return null;
    }
    throw error;
  }
}

async function createPrice(productId, unitAmount, currency, interval, lookupKey) {
  try {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency,
      recurring: {
        interval,
      },
      lookup_key: lookupKey,
      metadata: {
        keyfate_price: 'true',
      },
    });
    console.log(`✅ Created price: ${lookupKey} (${price.id}) - $${unitAmount / 100}/${interval}`);
    return price;
  } catch (error) {
    if (error.code === 'resource_already_exists') {
      console.log(`⚠️  Price already exists: ${lookupKey}`);
      return null;
    }
    throw error;
  }
}

async function setupStripeProducts() {
  console.log('🚀 Setting up Stripe products and prices for KeyFate...\n');

  try {
    // Create Pro product
    const proProduct = await createProduct(
      'KeyFate Pro',
      'Pro plan for power users who need maximum capacity and premium features'
    );

    if (proProduct) {
      // Create monthly price ($9.00)
      await createPrice(
        proProduct.id,
        900, // $9.00 in cents
        'usd',
        'month',
        'pro_monthly'
      );

      // Create yearly price ($90.00)
      await createPrice(
        proProduct.id,
        9000, // $90.00 in cents
        'usd',
        'year',
        'pro_yearly'
      );
    }

    console.log('\n✅ Stripe setup complete!');
    console.log('\n📋 Summary of created resources:');
    console.log('- Product: KeyFate Pro');
    console.log('- Price: pro_monthly ($9.00/month)');
    console.log('- Price: pro_yearly ($90.00/year)');
    console.log('\n🔗 You can view these in your Stripe Dashboard:');
    console.log('https://dashboard.stripe.com/products');

  } catch (error) {
    console.error('❌ Error setting up Stripe products:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupStripeProducts();
