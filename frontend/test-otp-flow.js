// Quick test to see if OTP validation is working
const { validateOTPToken } = require('./src/lib/auth/otp.ts');

async function test() {
  const result = await validateOTPToken('test@example.com', '123456');
  console.log('Validation result:', result);
}

test().catch(console.error);
