#!/usr/bin/env node

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

async function testCheckout() {
  console.log('🧪 Testing checkout session creation...\n');

  try {
    // Test with pro_monthly lookup key
    const response = await fetch('http://localhost:3000/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lookup_key: 'pro_monthly' }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.redirected) {
      console.log('✅ Redirected to:', response.url);
    } else {
      const data = await response.json();
      console.log('❌ Error response:', data);
    }

  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

// Wait a bit for the server to start
setTimeout(testCheckout, 3000);
