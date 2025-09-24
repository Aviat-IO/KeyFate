#!/usr/bin/env node

/**
 * Validate Cron Endpoints Script
 * Tests cron authentication for both local and production environments
 */

const https = require('https');
const http = require('http');

// Configuration
const environments = {
  local: {
    url: 'http://localhost:3000',
    cronSecret: 'local-test-secret-change-in-production'
  },
  staging: {
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://staging.keyfate.com',
    cronSecret: process.env.CRON_SECRET
  }
};

const endpoints = [
  '/api/cron/process-reminders',
  '/api/cron/check-secrets'
];

/**
 * Make HTTP request with Bearer token
 */
function makeRequest(baseUrl, endpoint, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, baseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'cron-validation-script/1.0'
      }
    };

    console.log(`\n🔍 Testing ${url.href}`);
    console.log(`📋 Headers:`, {
      'Authorization': `Bearer ${token.slice(0, 8)}...`,
      'Content-Type': 'application/json'
    });

    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            url: url.href,
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (e) {
          resolve({
            url: url.href,
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({ url: url.href, error: error.message });
    });

    req.write('{}');
    req.end();
  });
}

/**
 * Test all endpoints for an environment
 */
async function testEnvironment(env, config) {
  console.log(`\n📍 Testing ${env.toUpperCase()} environment:`);
  console.log(`🌐 Base URL: ${config.url}`);
  console.log(`🔑 CRON_SECRET present: ${!!config.cronSecret}`);
  console.log(`🔑 CRON_SECRET length: ${config.cronSecret?.length || 0}`);

  if (!config.cronSecret) {
    console.log(`❌ No CRON_SECRET configured for ${env} environment`);
    return;
  }

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const result = await makeRequest(config.url, endpoint, config.cronSecret);
      results.push(result);

      console.log(`\n📊 Result for ${endpoint}:`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Response:`, JSON.stringify(result.data, null, 2));

      if (result.status === 200) {
        console.log(`   ✅ SUCCESS`);
      } else if (result.status === 401) {
        console.log(`   ❌ UNAUTHORIZED - Check CRON_SECRET`);
      } else {
        console.log(`   ⚠️ UNEXPECTED STATUS`);
      }
    } catch (error) {
      console.log(`\n📊 Error for ${endpoint}:`);
      console.log(`   ❌ Request failed:`, error.error);
      results.push(error);
    }
  }

  return results;
}

/**
 * Test with invalid token
 */
async function testInvalidToken(baseUrl) {
  console.log(`\n🔒 Testing invalid token authentication:`);

  try {
    const result = await makeRequest(baseUrl, endpoints[0], 'invalid-token-12345');
    console.log(`   Status: ${result.status}`);
    console.log(`   Expected: 401, Got: ${result.status}`);

    if (result.status === 401) {
      console.log(`   ✅ Security working - invalid tokens rejected`);
    } else {
      console.log(`   ❌ Security issue - invalid tokens not rejected`);
    }
  } catch (error) {
    console.log(`   ❌ Request failed:`, error.error);
  }
}

/**
 * Test with no token
 */
async function testNoToken(baseUrl) {
  console.log(`\n🚫 Testing no token authentication:`);

  try {
    const url = new URL(endpoints[0], baseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const result = await new Promise((resolve, reject) => {
      const req = client.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            data: data
          });
        });
      });
      req.on('error', reject);
      req.write('{}');
      req.end();
    });

    console.log(`   Status: ${result.status}`);
    console.log(`   Expected: 401, Got: ${result.status}`);

    if (result.status === 401) {
      console.log(`   ✅ Security working - requests without tokens rejected`);
    } else {
      console.log(`   ❌ Security issue - requests without tokens not rejected`);
    }
  } catch (error) {
    console.log(`   ❌ Request failed:`, error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Cron Endpoint Validation Script');
  console.log('===================================');

  const env = process.argv[2] || 'local';
  const config = environments[env];

  if (!config) {
    console.log(`❌ Unknown environment: ${env}`);
    console.log(`Available environments: ${Object.keys(environments).join(', ')}`);
    process.exit(1);
  }

  // Test valid authentication
  const results = await testEnvironment(env, config);

  // Test security (invalid token)
  await testInvalidToken(config.url);

  // Test security (no token)
  await testNoToken(config.url);

  // Summary
  console.log(`\n📋 Summary for ${env.toUpperCase()}:`);
  console.log(`🌐 Base URL: ${config.url}`);

  if (results) {
    const successful = results.filter(r => r.status === 200).length;
    const failed = results.filter(r => r.status !== 200).length;
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
      console.log(`\n🛠️ Troubleshooting tips:`);
      console.log(`   1. Check that CRON_SECRET environment variable is set`);
      console.log(`   2. Verify the secret value matches between infrastructure and runtime`);
      console.log(`   3. Check Cloud Run logs for detailed error information`);
      console.log(`   4. Ensure the application is deployed with the latest configuration`);
    }
  }
}

// Handle command line usage
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { testEnvironment, makeRequest };