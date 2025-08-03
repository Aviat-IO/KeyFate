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

async function testDirectPayment() {
  console.log('🧪 Testing direct payment creation (bypassing checkout)...\n');

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });

  try {
    // Create a test customer
    console.log('👤 Creating test customer...');
    const customer = await stripe.customers.create({
      email: 'test@example.com',
      metadata: { test: 'true' },
    });
    console.log(`✅ Customer created: ${customer.id}`);

    // Create a payment intent directly
    console.log('\n💳 Creating payment intent...');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // $10.00
      currency: 'usd',
      customer: customer.id,
      metadata: { test: 'true' },
      description: 'Test payment for KeyFate',
    });

    console.log('✅ Payment intent created successfully!');
    console.log(`Payment Intent ID: ${paymentIntent.id}`);
    console.log(`Status: ${paymentIntent.status}`);
    console.log(`Amount: ${paymentIntent.amount} ${paymentIntent.currency}`);
    console.log(`Client Secret: ${paymentIntent.client_secret}`);

    // Test creating a subscription directly
    console.log('\n📅 Testing subscription creation...');
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: 'price_1Rrsl5DUYpDAdqqALCi6m3ul' }], // Your pro_monthly price
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: { test: 'true' },
      });

      console.log('✅ Subscription created successfully!');
      console.log(`Subscription ID: ${subscription.id}`);
      console.log(`Status: ${subscription.status}`);
      console.log(`Latest Invoice: ${subscription.latest_invoice?.id}`);

    } catch (error) {
      console.error('❌ Subscription creation failed:', error.message);
      console.error('Error type:', error.type);
      console.error('Error code:', error.code);
    }

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await stripe.customers.del(customer.id);
    console.log('✅ Test customer deleted');

    console.log('\n📋 Summary:');
    console.log('- ✅ Customer creation works');
    console.log('- ✅ Payment intent creation works');
    console.log('- ❌ Checkout sessions fail (but API works)');
    console.log('\n💡 This suggests the issue is specifically with Stripe Checkout, not the account itself.');

  } catch (error) {
    console.error('❌ Error testing direct payment:', error.message);
    console.error('Error type:', error.type);
    console.error('Error code:', error.code);
  }
}

testDirectPayment();
