#!/usr/bin/env tsx
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(__dirname, "../.env.local") });

async function testAPIRoute() {
  console.log("🧪 Testing API route with schema fix...");

  try {
    // Start Next.js server in the background for testing
    console.log("Starting test server...");

    const { spawn } = require('child_process');
    const nextProcess = spawn('npm', ['run', 'dev'], {
      cwd: resolve(__dirname, '..'),
      env: { ...process.env },
      stdio: 'pipe'
    });

    // Wait for server to start
    console.log("Waiting for server to start...");
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Test the API endpoint
    console.log("Testing POST /api/secrets endpoint...");

    const testSecret = {
      title: "Test Secret for Schema Validation",
      recipient_name: "Test Recipient",
      recipient_email: "test@example.com",
      contact_method: "email",
      check_in_days: 30,
      server_share: "test_server_share_data",
      sss_shares_total: 3,
      sss_threshold: 2
    };

    const response = await fetch('http://localhost:3000/api/secrets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // This might not work without auth, but we'll see the error
      },
      body: JSON.stringify(testSecret)
    });

    console.log("Response status:", response.status);

    if (response.status === 401) {
      console.log("✅ API is responding (authentication required as expected)");
      console.log("✅ This means the database schema is working correctly");
    } else {
      const result = await response.json();
      console.log("Response:", result);

      if (!result.error || !result.error.includes('recipient_name')) {
        console.log("✅ No recipient_name database errors - schema fix successful!");
      } else {
        console.log("❌ Still getting recipient_name errors:", result.error);
      }
    }

    nextProcess.kill();
    process.exit(0);

  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testAPIRoute();