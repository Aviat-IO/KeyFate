#!/usr/bin/env node

/**
 * Validation script for cron endpoints
 * Tests that Google Cloud Scheduler can authenticate with cron routes
 *
 * Usage:
 *   node scripts/validate-cron-endpoints.js <BASE_URL> <CRON_SECRET>
 *
 * Examples:
 *   node scripts/validate-cron-endpoints.js http://localhost:3000 your-cron-secret
 *   node scripts/validate-cron-endpoints.js https://yourapp.com your-cron-secret
 */

const [, , baseUrl, cronSecret] = process.argv;

if (!baseUrl || !cronSecret) {
  console.error('Usage: node validate-cron-endpoints.js <BASE_URL> <CRON_SECRET>');
  process.exit(1);
}

async function validateEndpoint(url, secret) {
  try {
    console.log(`Testing ${url}...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'User-Agent': 'Google-Cloud-Scheduler',
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.status === 200) {
      console.log(`✅ ${url} - SUCCESS`);
      console.log(`   Response: ${JSON.stringify(data)}`);
      return true;
    } else {
      console.log(`❌ ${url} - FAILED (${response.status})`);
      console.log(`   Response: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${url} - ERROR`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function validateSecurity(baseUrl, cronSecret) {
  console.log('\n🔒 Testing security restrictions...');

  try {
    // Test that cron token doesn't work for user routes
    const response = await fetch(`${baseUrl}/api/secrets`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'User-Agent': 'Google-Cloud-Scheduler',
      },
    });

    if (response.status === 401) {
      console.log('✅ Security test passed - cron token rejected for user routes');
      return true;
    } else {
      console.log('❌ Security test failed - cron token should not access user routes');
      return false;
    }
  } catch (error) {
    console.log(`❌ Security test error: ${error.message}`);
    return false;
  }
}

async function testInvalidAuth(baseUrl) {
  console.log('\n🚫 Testing invalid authentication...');

  try {
    const response = await fetch(`${baseUrl}/api/cron/process-reminders`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer wrong-secret',
        'User-Agent': 'Google-Cloud-Scheduler',
      },
    });

    if (response.status === 401) {
      console.log('✅ Invalid auth test passed - wrong token rejected');
      return true;
    } else {
      console.log('❌ Invalid auth test failed - wrong token should be rejected');
      return false;
    }
  } catch (error) {
    console.log(`❌ Invalid auth test error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Validating cron endpoints...');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Secret: ${'*'.repeat(cronSecret.length)}\n`);

  const endpoints = [
    `${baseUrl}/api/cron/process-reminders`,
    `${baseUrl}/api/cron/check-secrets`,
  ];

  const results = [];

  // Test valid authentication
  for (const endpoint of endpoints) {
    const success = await validateEndpoint(endpoint, cronSecret);
    results.push(success);
  }

  // Test security restrictions
  const securityResult = await validateSecurity(baseUrl, cronSecret);
  results.push(securityResult);

  // Test invalid authentication
  const invalidAuthResult = await testInvalidAuth(baseUrl);
  results.push(invalidAuthResult);

  const allPassed = results.every(result => result);

  console.log('\n📊 Results:');
  console.log(`${allPassed ? '✅' : '❌'} Overall: ${allPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`Successful tests: ${results.filter(r => r).length}/${results.length}`);

  if (allPassed) {
    console.log('\n🎉 All cron endpoints are working correctly!');
    console.log('Google Cloud Scheduler should be able to call these endpoints.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the deployment configuration.');
    console.log('Make sure CRON_SECRET environment variable is set correctly.');
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});