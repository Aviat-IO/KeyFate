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

async function checkStripeSetup() {
  console.log('🔍 Comprehensive Stripe Account Setup Check...\n');

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });

  try {
    // Get account details
    const account = await stripe.accounts.retrieve();

    console.log('📋 Account Status:');
    console.log(`✅ Account ID: ${account.id}`);
    console.log(`✅ Type: ${account.type}`);
    console.log(`✅ Country: ${account.country}`);
    console.log(`✅ Business Type: ${account.business_type}`);
    console.log(`✅ Charges Enabled: ${account.charges_enabled}`);
    console.log(`✅ Payouts Enabled: ${account.payouts_enabled}`);
    console.log(`✅ Details Submitted: ${account.details_submitted}`);
    console.log(`✅ Payments Enabled: ${account.payments_enabled}`);

    // Check business profile
    console.log('\n🏢 Business Profile:');
    if (account.business_profile) {
      console.log(`✅ Business Name: ${account.business_profile.name || 'Not set'}`);
      console.log(`✅ Business URL: ${account.business_profile.url || 'Not set'}`);
      console.log(`✅ Support Email: ${account.business_profile.support_email || 'Not set'}`);
      console.log(`✅ Support Phone: ${account.business_profile.support_phone || 'Not set'}`);

      // Check if business profile is complete
      const missingBusinessFields = [];
      if (!account.business_profile.name) missingBusinessFields.push('Business Name');
      if (!account.business_profile.url) missingBusinessFields.push('Business URL');
      if (!account.business_profile.support_email) missingBusinessFields.push('Support Email');

      if (missingBusinessFields.length > 0) {
        console.log(`⚠️  Missing business profile fields: ${missingBusinessFields.join(', ')}`);
      } else {
        console.log('✅ Business profile is complete');
      }
    } else {
      console.log('❌ No business profile found');
    }

    // Check account requirements
    console.log('\n🔧 Account Requirements:');
    if (account.requirements) {
      const requirements = account.requirements;
      console.log(`Currently Due: ${requirements.currently_due?.length || 0} items`);
      console.log(`Eventually Due: ${requirements.eventually_due?.length || 0} items`);
      console.log(`Past Due: ${requirements.past_due?.length || 0} items`);
      console.log(`Payouts Pending: ${requirements.payouts_pending?.length || 0} items`);

      if (requirements.currently_due && requirements.currently_due.length > 0) {
        console.log('\n⚠️  Currently Due Requirements:');
        requirements.currently_due.forEach(req => console.log(`  - ${req}`));
      }

      if (requirements.past_due && requirements.past_due.length > 0) {
        console.log('\n❌ Past Due Requirements:');
        requirements.past_due.forEach(req => console.log(`  - ${req}`));
      }

      if (requirements.disabled_reason) {
        console.log(`\n❌ Account Disabled: ${requirements.disabled_reason}`);
      }
    } else {
      console.log('✅ No requirements found');
    }

    // Check capabilities
    console.log('\n🔧 Account Capabilities:');
    if (account.capabilities) {
      Object.entries(account.capabilities).forEach(([capability, status]) => {
        const statusIcon = status === 'active' ? '✅' : status === 'pending' ? '⚠️' : '❌';
        console.log(`${statusIcon} ${capability}: ${status}`);
      });
    }

    // Test creating a simple checkout session
    console.log('\n🧪 Testing Checkout Session Creation:');
    try {
      const testSession = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Test Product',
              },
              unit_amount: 100,
            },
            quantity: 1,
          },
        ],
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      });

      console.log('✅ Checkout session created successfully!');
      console.log(`Session ID: ${testSession.id}`);
      console.log(`URL: ${testSession.url}`);

      // Test if we can retrieve the session
      const retrievedSession = await stripe.checkout.sessions.retrieve(testSession.id);
      console.log(`✅ Session retrieval works: ${retrievedSession.status}`);

      // Clean up test session
      await stripe.checkout.sessions.expire(testSession.id);
      console.log('✅ Test session expired');

    } catch (error) {
      console.error('❌ Checkout session creation failed:', error.message);
      console.error('Error type:', error.type);
      console.error('Error code:', error.code);
    }

    // Check for common setup issues
    console.log('\n🔍 Common Setup Issues Check:');

    const issues = [];

    if (!account.charges_enabled) {
      issues.push('Charges are not enabled');
    }

    if (!account.details_submitted) {
      issues.push('Account details not submitted');
    }

    if (account.requirements?.past_due?.length > 0) {
      issues.push('Account has past due requirements');
    }

    if (!account.business_profile?.name) {
      issues.push('Business name not set');
    }

    if (!account.business_profile?.url) {
      issues.push('Business URL not set');
    }

    if (!account.business_profile?.support_email) {
      issues.push('Support email not set');
    }

    if (issues.length > 0) {
      console.log('❌ Found setup issues:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    } else {
      console.log('✅ No obvious setup issues found');
    }

    console.log('\n💡 Setup Recommendations:');
    console.log('1. Go to https://dashboard.stripe.com/account');
    console.log('2. Complete your business profile');
    console.log('3. Add a business URL and support email');
    console.log('4. Verify your identity if required');
    console.log('5. Enable any required payment methods');

  } catch (error) {
    console.error('❌ Error checking Stripe setup:', error.message);
  }
}

checkStripeSetup();
