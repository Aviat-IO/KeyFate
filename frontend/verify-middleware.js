#!/usr/bin/env node

/**
 * Verification script for NextAuth middleware compilation
 */

console.log('🔍 Verifying NextAuth middleware compilation...\n');

// Test 1: Check if both import paths work
try {
  console.log('1. Testing next-auth/jwt import...');
  const jwt = require('next-auth/jwt');
  console.log('   ✅ next-auth/jwt imported successfully');
  console.log('   📦 Available exports:', Object.keys(jwt));
} catch (error) {
  console.log('   ❌ next-auth/jwt import failed:', error.message);
}

try {
  console.log('\n2. Testing next-auth/middleware import...');
  const middleware = require('next-auth/middleware');
  console.log('   ✅ next-auth/middleware imported successfully');
  console.log('   📦 Available exports:', Object.keys(middleware));
} catch (error) {
  console.log('   ❌ next-auth/middleware import failed:', error.message);
}

// Test 2: Check our actual middleware file
try {
  console.log('\n3. Testing our middleware file compilation...');
  const fs = require('fs');
  const path = require('path');

  const middlewarePath = path.join(__dirname, 'src', 'middleware.ts');
  const content = fs.readFileSync(middlewarePath, 'utf8');

  if (content.includes('next-auth/middleware')) {
    console.log('   ⚠️  Our middleware file uses next-auth/middleware');
  } else {
    console.log('   ✅ Our middleware file uses next-auth/jwt (correct)');
  }

  console.log('   📝 Import line:', content.match(/import.*next-auth.*/)[0]);
} catch (error) {
  console.log('   ❌ Failed to read middleware file:', error.message);
}

// Test 3: Check if TypeScript can resolve the modules
try {
  console.log('\n4. Testing TypeScript module resolution...');
  const { execSync } = require('child_process');

  // Run TypeScript compiler check on middleware file
  execSync('npx tsc --noEmit src/middleware.ts', { stdio: 'inherit' });
  console.log('   ✅ TypeScript compilation successful');
} catch (error) {
  console.log('   ❌ TypeScript compilation failed');
}

console.log('\n🎉 Verification complete!');