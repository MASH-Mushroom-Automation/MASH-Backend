const axios = require('axios');

// Configuration
const RELAY_URL = process.env.RELAY_URL || 'http://localhost:2525';
const TEST_EMAIL = process.env.TEST_EMAIL || 'your-email@example.com';

// Test email data
const testEmail = {
  to: TEST_EMAIL,
  subject: 'MASH SMTP Relay Test',
  html: `
    <h1>✅ SMTP Relay Test Successful!</h1>
    <p>This email was sent from the MASH SMTP relay server.</p>
    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    <hr>
    <p><em>MASH Mushroom Automation - E-commerce + IoT Platform</em></p>
  `,
  text: 'SMTP Relay Test Successful! Timestamp: ' + new Date().toISOString(),
};

async function testRelay() {
  console.log('🧪 Testing SMTP Relay...\n');
  console.log(`📍 Relay URL: ${RELAY_URL}`);
  console.log(`📧 Test Email: ${TEST_EMAIL}\n`);

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await axios.get(`${RELAY_URL}/health`);
    console.log('✅ Health check passed');
    console.log('   Response:', JSON.stringify(healthResponse.data, null, 2));
    console.log();

    // Test 2: Send email
    console.log('2️⃣ Sending test email...');
    const emailResponse = await axios.post(`${RELAY_URL}/send-email`, testEmail, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    console.log('✅ Email sent successfully');
    console.log('   Message ID:', emailResponse.data.messageId);
    console.log('   Response:', emailResponse.data.response);
    console.log();

    console.log('🎉 All tests passed!');
    console.log(`📬 Check your inbox at: ${TEST_EMAIL}`);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run test
testRelay();
