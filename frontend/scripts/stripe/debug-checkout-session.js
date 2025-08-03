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

async function debugCheckoutSession(sessionId) {
  console.log(`🔍 Debugging checkout session: ${sessionId}\n`);

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'line_items', 'payment_intent', 'subscription'],
    });

    console.log('📋 Session Details:');
    console.log(`ID: ${session.id}`);
    console.log(`Status: ${session.status}`);
    console.log(`Mode: ${session.mode}`);
    console.log(`Payment Status: ${session.payment_status}`);
    console.log(`URL: ${session.url}`);
    console.log(`Success URL: ${session.success_url}`);
    console.log(`Cancel URL: ${session.cancel_url}`);
    console.log(`Created: ${new Date(session.created * 1000).toISOString()}`);
    console.log(`Expires: ${new Date(session.expires_at * 1000).toISOString()}`);

    console.log('\n👤 Customer:');
    if (session.customer) {
      console.log(`ID: ${session.customer.id}`);
      console.log(`Email: ${session.customer.email}`);
    } else {
      console.log('No customer associated');
    }

    console.log('\n🛒 Line Items:');
    if (session.line_items && session.line_items.data.length > 0) {
      session.line_items.data.forEach((item, index) => {
        console.log(`Item ${index + 1}:`);
        console.log(`  Price: ${item.price.id}`);
        console.log(`  Amount: ${item.amount_total} ${item.currency}`);
        console.log(`  Description: ${item.description}`);
      });
    } else {
      console.log('No line items found');
    }

    console.log('\n🔧 Configuration:');
    console.log(`Billing Address Collection: ${session.billing_address_collection}`);
    console.log(`Customer Creation: ${session.customer_creation}`);
    console.log(`Payment Method Collection: ${session.payment_method_collection}`);
    console.log(`Payment Method Types: ${session.payment_method_types?.join(', ')}`);

    console.log('\n📝 Metadata:');
    console.log(JSON.stringify(session.metadata, null, 2));

    // Check if session is expired
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at < now) {
      console.log('\n⚠️  WARNING: This session has expired!');
    }

    // Check if URLs are valid
    if (session.success_url && !session.success_url.includes('localhost:3000')) {
      console.log('\n⚠️  WARNING: Success URL does not match expected domain');
    }

    if (session.cancel_url && !session.cancel_url.includes('localhost:3000')) {
      console.log('\n⚠️  WARNING: Cancel URL does not match expected domain');
    }

  } catch (error) {
    console.error('❌ Error retrieving session:', error.message);

    if (error.type === 'StripeInvalidRequestError') {
      console.error('This usually means the session ID is invalid or the session has been deleted');
    }
  }
}

// Get session ID from command line argument or use the latest one from logs
const sessionId = process.argv[2] || 'cs_test_a1lOOvNiUgTNggkmmWHcnf7qmn0lL7TWMBNvVoWWVxF5fJI8iFmJAblQJj';

debugCheckoutSession(sessionId);
