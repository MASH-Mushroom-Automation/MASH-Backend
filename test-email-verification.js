#!/usr/bin/env node

/**
 * Email Verification System Test Script
 * 
 * This script tests the complete email verification flow:
 * 1. Register a new user
 * 2. Verify email with code
 * 3. Test resend verification
 * 
 * Usage:
 *   node test-email-verification.js <your-email@example.com>
 * 
 * Prerequisites:
 *   - Server must be running on http://localhost:3000
 *   - Replace <verification-code> with the code from your email
 */

const http = require('http');

const API_BASE_URL = 'http://localhost:3000/api/v1';

// Get email from command line arguments
const testEmail = process.argv[2];

if (!testEmail) {
  console.error('❌ Error: Email address required');
  console.log('Usage: node test-email-verification.js <your-email@example.com>');
  process.exit(1);
}

// Generate random username to avoid conflicts
const randomUsername = `testuser_${Date.now()}`;

console.log('\n🚀 Starting Email Verification Test\n');
console.log('📧 Test Email:', testEmail);
console.log('👤 Test Username:', randomUsername);
console.log('═'.repeat(60));

/**
 * Make HTTP POST request
 */
function makeRequest(endpoint, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE_URL);
    const postData = JSON.stringify(data);

    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: response });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Test Step 1: Register new user
 */
async function testRegistration() {
  console.log('\n📝 Step 1: Registering new user...');

  try {
    const response = await makeRequest('/auth/register', {
      email: testEmail,
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
      username: randomUsername,
    });

    if (response.statusCode === 201 && response.data.success) {
      console.log('✅ Registration successful!');
      console.log('   User ID:', response.data.userId);
      console.log('   Email:', response.data.email);
      console.log('   Username:', response.data.username);
      console.log('   Avatar:', response.data.avatarUrl);
      console.log('   Verification Sent:', response.data.verificationSent);
      return response.data;
    } else {
      console.error('❌ Registration failed:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Registration error:', error.message);
    return null;
  }
}

/**
 * Test Step 2: Test email service (optional)
 */
async function testEmailService() {
  console.log('\n📧 Step 2: Testing email service...');

  try {
    const response = await makeRequest('/notifications/test-template/verification', {
      to: testEmail,
      firstName: 'Test',
    });

    if (response.statusCode === 200 && response.data.success) {
      console.log('✅ Test email sent successfully!');
      console.log('   Template:', response.data.template);
      console.log('   Timestamp:', response.data.timestamp);
      return true;
    } else {
      console.error('⚠️  Test email failed:', response.data);
      return false;
    }
  } catch (error) {
    console.error('⚠️  Test email error:', error.message);
    return false;
  }
}

/**
 * Test Step 3: Verify email (requires manual code entry)
 */
async function promptForVerification() {
  console.log('\n📬 Step 3: Email Verification');
  console.log('═'.repeat(60));
  console.log('📨 Check your email inbox for:');
  console.log('   1. Email from Clerk with 6-digit verification code');
  console.log('   2. Email from MASH with verification link');
  console.log('');
  console.log('🔢 To verify your email, run:');
  console.log(`   node test-email-verification.js verify ${testEmail} <6-digit-code>`);
  console.log('');
  console.log('Example:');
  console.log(`   node test-email-verification.js verify ${testEmail} 123456`);
}

/**
 * Verify email with code
 */
async function verifyEmail(email, code) {
  console.log('\n🔐 Verifying email with code...');
  console.log('   Email:', email);
  console.log('   Code:', code);

  try {
    const response = await makeRequest('/auth/verify-email', {
      email: email,
      code: code,
    });

    if (response.statusCode === 200 && response.data.success) {
      console.log('✅ Email verified successfully!');
      console.log('   Message:', response.data.message);
      console.log('   User ID:', response.data.user?.id);
      console.log('   User Email:', response.data.user?.email);
      console.log('   User Role:', response.data.user?.role);
      console.log('   Access Token:', response.data.accessToken ? '✓ Generated' : '✗ Missing');
      console.log('   Refresh Token:', response.data.refreshToken ? '✓ Generated' : '✗ Missing');
      return response.data;
    } else {
      console.error('❌ Email verification failed:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Verification error:', error.message);
    return null;
  }
}

/**
 * Test Step 4: Resend verification
 */
async function testResendVerification(email) {
  console.log('\n♻️  Testing resend verification...');

  try {
    const response = await makeRequest('/auth/resend-verification', {
      email: email,
    });

    if (response.statusCode === 200 && response.data.success) {
      console.log('✅ Verification email resent successfully!');
      console.log('   Message:', response.data.message);
      return true;
    } else {
      console.error('❌ Resend verification failed:', response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Resend verification error:', error.message);
    return false;
  }
}

/**
 * Main test flow
 */
async function runTests() {
  console.log('🔍 Testing server availability...');
  
  try {
    // Test if server is running
    const healthCheck = await makeRequest('/health', {}).catch(() => null);
    if (!healthCheck) {
      console.error('❌ Server is not running on http://localhost:3000');
      console.log('   Please start the server with: npm run start:dev');
      process.exit(1);
    }
    console.log('✅ Server is running');

    // Step 1: Register user
    const registrationResult = await testRegistration();
    if (!registrationResult) {
      console.error('\n❌ Test failed at registration step');
      process.exit(1);
    }

    // Step 2: Test email service (optional)
    console.log('\n📧 Sending test verification email...');
    await testEmailService();

    // Step 3: Prompt for manual verification
    await promptForVerification();

    console.log('\n═'.repeat(60));
    console.log('✅ Registration and email sending completed!');
    console.log('📧 Check your email and run the verify command above.');
    console.log('═'.repeat(60));
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main() {
  const command = process.argv[2];

  if (command === 'verify') {
    // Verify email with code
    const email = process.argv[3];
    const code = process.argv[4];

    if (!email || !code) {
      console.error('❌ Usage: node test-email-verification.js verify <email> <code>');
      process.exit(1);
    }

    const result = await verifyEmail(email, code);
    if (result) {
      console.log('\n✅ EMAIL VERIFICATION COMPLETE!');
      console.log('🎉 You can now use the access token to make authenticated requests.');
    } else {
      console.log('\n❌ EMAIL VERIFICATION FAILED');
      console.log('💡 Try running: node test-email-verification.js resend <email>');
    }
  } else if (command === 'resend') {
    // Resend verification email
    const email = process.argv[3];

    if (!email) {
      console.error('❌ Usage: node test-email-verification.js resend <email>');
      process.exit(1);
    }

    const result = await testResendVerification(email);
    if (result) {
      console.log('\n✅ Verification email resent! Check your inbox.');
    }
  } else {
    // Run full registration test
    await runTests();
  }
}

// Run the script
main();
