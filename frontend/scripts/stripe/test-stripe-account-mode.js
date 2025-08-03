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

async function testStripeAccountMode() {
  console.log('🔍 Testing Stripe account mode and restrictions...\n');

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });

  try {
    // Get account details
    const account = await stripe.accounts.retrieve();

    console.log('📋 Account Mode Check:');
    console.log(`Account ID: ${account.id}`);
    console.log(`Type: ${account.type}`);
    console.log(`Country: ${account.country}`);
    console.log(`Default Currency: ${account.default_currency}`);
    console.log(`Charges Enabled: ${account.charges_enabled}`);
    console.log(`Payouts Enabled: ${account.payouts_enabled}`);
    console.log(`Details Submitted: ${account.details_submitted}`);
    console.log(`Payments Enabled: ${account.payments_enabled}`);

    // Check if this is a test account
    const isTestAccount = account.id.startsWith('acct_') && account.id.includes('test');
    console.log(`\n🧪 Test Account: ${isTestAccount ? 'Yes' : 'No'}`);

    // Check business profile
    if (account.business_profile) {
      console.log('\n🏢 Business Profile:');
      console.log(`Name: ${account.business_profile.name}`);
      console.log(`URL: ${account.business_profile.url}`);
      console.log(`Support Email: ${account.business_profile.support_email}`);
      console.log(`Support Phone: ${account.business_profile.support_phone}`);

      // Check if this looks like a sandbox/test account
      if (account.business_profile.url && account.business_profile.url.includes('accessible.stripe.com')) {
        console.log('\n⚠️  This appears to be a Stripe sandbox/test account');
        console.log('Sandbox accounts may have different behavior than regular test accounts');
      }
    }

    // Check capabilities
    console.log('\n🔧 Account Capabilities:');
    if (account.capabilities) {
      Object.entries(account.capabilities).forEach(([capability, status]) => {
        console.log(`  ${capability}: ${status}`);
      });
    }

    // Test creating a very simple checkout session with minimal configuration
    console.log('\n🧪 Testing ultra-minimal checkout session...');

    try {
      const minimalSession = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Test',
              },
              unit_amount: 100,
            },
            quantity: 1,
          },
        ],
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      });

      console.log('✅ Ultra-minimal checkout session created successfully!');
      console.log(`Session ID: ${minimalSession.id}`);
      console.log(`URL: ${minimalSession.url}`);

      // Test if we can retrieve the session
      const retrievedSession = await stripe.checkout.sessions.retrieve(minimalSession.id);
      console.log(`✅ Session retrieval works: ${retrievedSession.status}`);

    } catch (error) {
      console.error('❌ Ultra-minimal checkout session failed:', error.message);
      console.error('Error type:', error.type);
      console.error('Error code:', error.code);
    }

    // Check if there are any account restrictions
    console.log('\n🚫 Checking for account restrictions...');

    if (account.requirements) {
      const restrictions = [];

      if (account.requirements.currently_due && account.requirements.currently_due.length > 0) {
        restrictions.push(`Currently due: ${account.requirements.currently_due.join(', ')}`);
      }

      if (account.requirements.past_due && account.requirements.past_due.length > 0) {
        restrictions.push(`Past due: ${account.requirements.past_due.join(', ')}`);
      }

      if (account.requirements.disabled_reason) {
        restrictions.push(`Disabled reason: ${account.requirements.disabled_reason}`);
      }

      if (restrictions.length > 0) {
        console.log('⚠️  Account restrictions found:');
        restrictions.forEach(restriction => console.log(`  - ${restriction}`));
      } else {
        console.log('✅ No account restrictions found');
      }
    }

    console.log('\n💡 Recommendations:');

    if (account.business_profile?.url?.includes('accessible.stripe.com')) {
      console.log('  - This appears to be a sandbox account. Try using a regular test account instead.');
      console.log('  - Create a new test account at https://dashboard.stripe.com/test/apikeys');
    }

    if (!account.charges_enabled) {
      console.log('  - Enable charges in your Stripe Dashboard');
    }

    if (!account.details_submitted) {
      console.log('  - Complete your account details in Stripe Dashboard');
    }

  } catch (error) {
    console.error('❌ Error testing Stripe account:', error.message);
  }
}

testStripeAccountMode();
