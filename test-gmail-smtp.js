/**
 * Gmail SMTP Connection Test
 * Tests if Gmail SMTP credentials are valid and can send emails
 * Run: node test-gmail-smtp.js
 */

const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('\n🔍 Gmail SMTP Connection Test');
console.log('================================\n');

// Display configuration (hide password)
console.log('Configuration:');
console.log(`  Host: ${process.env.EMAIL_HOST}`);
console.log(`  Port: ${process.env.EMAIL_PORT}`);
console.log(`  User: ${process.env.EMAIL_USER}`);
console.log(`  Password: ${process.env.EMAIL_PASSWORD ? '****' + process.env.EMAIL_PASSWORD.slice(-4) : 'NOT SET'}`);
console.log(`  From: ${process.env.EMAIL_FROM}\n`);

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

console.log('Step 1: Verifying SMTP connection...');

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.log('\n❌ SMTP Connection FAILED!');
    console.log('\nError Details:');
    console.log(`  Code: ${error.code || 'N/A'}`);
    console.log(`  Command: ${error.command || 'N/A'}`);
    console.log(`  Message: ${error.message || 'Unknown error'}`);
    
    console.log('\n🔧 SOLUTION:');
    if (error.message.includes('Username and Password not accepted')) {
      console.log('  Gmail App Password is INVALID or EXPIRED!');
      console.log('\n  Fix Steps:');
      console.log('  1. Go to: https://myaccount.google.com/apppasswords');
      console.log('  2. Sign in as: MASH.Mushroom.Automation@gmail.com');
      console.log('  3. Generate NEW App Password');
      console.log('  4. Update .env file (line 52): EMAIL_PASSWORD=xxxx xxxx xxxx xxxx');
      console.log('  5. Re-run: node test-gmail-smtp.js');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('  Cannot connect to Gmail SMTP server!');
      console.log('  Check your internet connection or firewall settings.');
    } else {
      console.log('  Unknown error. Check your .env configuration.');
    }
    
    process.exit(1);
  } else {
    console.log('✅ SMTP Connection SUCCESSFUL!\n');
    
    console.log('Step 2: Sending test email...');
    
    // Send test email
    const testEmail = {
      from: process.env.EMAIL_FROM || 'MASH System <noreply@mash.com>',
      to: process.env.EMAIL_USER, // Send to self for testing
      subject: '✅ MASH Email System Test',
      text: 'This is a test email from MASH Backend. If you received this, Gmail SMTP is working correctly!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">✅ MASH Email System Test</h2>
          <p>This is a test email from <strong>MASH Backend</strong>.</p>
          <p>If you received this email, your Gmail SMTP configuration is working correctly!</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Sent: ${new Date().toLocaleString()}<br>
            From: MASH Backend Email Service<br>
            Test: Gmail SMTP Connection Verification
          </p>
        </div>
      `,
    };
    
    transporter.sendMail(testEmail, (error, info) => {
      if (error) {
        console.log('\n❌ Test Email FAILED to send!');
        console.log('\nError Details:');
        console.log(`  ${error.message}`);
        process.exit(1);
      } else {
        console.log('✅ Test Email SENT successfully!\n');
        console.log('Email Details:');
        console.log(`  Message ID: ${info.messageId}`);
        console.log(`  Sent to: ${process.env.EMAIL_USER}`);
        console.log(`  Response: ${info.response}\n`);
        
        console.log('🎉 SUCCESS! Gmail SMTP is working perfectly!');
        console.log('\nNext Steps:');
        console.log('  1. Check inbox: ' + process.env.EMAIL_USER);
        console.log('  2. Verify you received the test email');
        console.log('  3. Start your server: npm run start:dev');
        console.log('  4. Test registration API with Postman\n');
        
        process.exit(0);
      }
    });
  }
});
