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

async function testMinimalCheckout() {
  console.log('🧪 Testing minimal checkout session...\n');

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });

  try {
    // Create a minimal checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Test Product',
            },
            unit_amount: 1000, // $10.00
          },
          quantity: 1,
        },
      ],
      success_url: 'http://localhost:3000/test-checkout?success=true',
      cancel_url: 'http://localhost:3000/test-checkout?canceled=true',
    });

    console.log('✅ Minimal checkout session created successfully!');
    console.log(`Session ID: ${session.id}`);
    console.log(`URL: ${session.url}`);
    console.log('\n🔗 Try accessing this URL directly:');
    console.log(session.url);
    console.log('\n📝 If this works, the issue is with the subscription checkout configuration.');
    console.log('If this also fails, it\'s a broader Stripe or account issue.');

  } catch (error) {
    console.error('❌ Error creating minimal checkout session:', error.message);
  }
}

testMinimalCheckout();
