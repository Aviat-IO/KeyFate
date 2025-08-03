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

async function checkStripeAccount() {
  console.log('🔍 Checking Stripe account configuration...\n');

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });

  try {
    // Get account details
    const account = await stripe.accounts.retrieve();

    console.log('📋 Account Details:');
    console.log(`ID: ${account.id}`);
    console.log(`Type: ${account.type}`);
    console.log(`Country: ${account.country}`);
    console.log(`Business Type: ${account.business_type}`);
    console.log(`Charges Enabled: ${account.charges_enabled}`);
    console.log(`Payouts Enabled: ${account.payouts_enabled}`);
    console.log(`Details Submitted: ${account.details_submitted}`);
    console.log(`Payments Enabled: ${account.payments_enabled}`);

    if (account.business_profile) {
      console.log(`Business Name: ${account.business_profile.name}`);
      console.log(`Business URL: ${account.business_profile.url}`);
      console.log(`Support Email: ${account.business_profile.support_email}`);
      console.log(`Support Phone: ${account.business_profile.support_phone}`);
    }

    console.log('\n🔧 Account Requirements:');
    if (account.requirements) {
      console.log(`Currently Due: ${account.requirements.currently_due?.length || 0} items`);
      console.log(`Eventually Due: ${account.requirements.eventually_due?.length || 0} items`);
      console.log(`Past Due: ${account.requirements.past_due?.length || 0} items`);
      console.log(`Payouts Pending: ${account.requirements.payouts_pending?.length || 0} items`);

      if (account.requirements.currently_due && account.requirements.currently_due.length > 0) {
        console.log('\n⚠️  Currently Due Requirements:');
        account.requirements.currently_due.forEach(req => {
          console.log(`  - ${req}`);
        });
      }

      if (account.requirements.past_due && account.requirements.past_due.length > 0) {
        console.log('\n❌ Past Due Requirements:');
        account.requirements.past_due.forEach(req => {
          console.log(`  - ${req}`);
        });
      }
    }

    console.log('\n🌐 Checkout Settings:');

    // Check if there are any checkout settings that might be causing issues
    try {
      const checkoutSessions = await stripe.checkout.sessions.list({ limit: 1 });
      console.log(`✅ Can list checkout sessions (${checkoutSessions.data.length} found)`);
    } catch (error) {
      console.log(`❌ Cannot list checkout sessions: ${error.message}`);
    }

    // Check webhook endpoints
    try {
      const webhooks = await stripe.webhookEndpoints.list();
      console.log(`\n🔗 Webhook Endpoints: ${webhooks.data.length}`);
      webhooks.data.forEach(webhook => {
        console.log(`  - ${webhook.url} (${webhook.status})`);
      });
    } catch (error) {
      console.log(`❌ Cannot list webhooks: ${error.message}`);
    }

    // Check if account is properly configured for checkout
    if (!account.charges_enabled) {
      console.log('\n❌ CHARGES ARE NOT ENABLED - This will prevent checkout sessions from working!');
    }

    if (!account.details_submitted) {
      console.log('\n❌ ACCOUNT DETAILS NOT SUBMITTED - This may prevent checkout sessions from working!');
    }

    if (account.requirements && account.requirements.past_due && account.requirements.past_due.length > 0) {
      console.log('\n❌ ACCOUNT HAS PAST DUE REQUIREMENTS - This will prevent checkout sessions from working!');
    }

    console.log('\n💡 Recommendations:');
    if (!account.charges_enabled) {
      console.log('  - Enable charges in your Stripe Dashboard');
    }
    if (!account.details_submitted) {
      console.log('  - Complete your account details in Stripe Dashboard');
    }
    if (account.requirements && account.requirements.past_due && account.requirements.past_due.length > 0) {
      console.log('  - Complete all past due requirements in Stripe Dashboard');
    }

  } catch (error) {
    console.error('❌ Error checking Stripe account:', error.message);
  }
}

checkStripeAccount();
