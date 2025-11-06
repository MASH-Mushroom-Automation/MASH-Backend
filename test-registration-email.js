/**
 * Test Registration Email Functionality
 * 
 * This script tests the email sending during user registration.
 * It simulates the email service call that happens during registration.
 */

const nodemailer = require('nodemailer');
require('dotenv').config();

async function testRegistrationEmail() {
  console.log('🧪 Testing Registration Email Functionality\n');
  
  // 1. Check environment variables
  console.log('📋 Step 1: Checking environment variables...');
  const requiredVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
    console.error('⚠️  Please configure these in your .env file');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set\n');
  
  // 2. Create transporter
  console.log('📋 Step 2: Creating email transporter...');
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  
  // 3. Verify transporter
  console.log('📋 Step 3: Verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully\n');
  } catch (error) {
    console.error('❌ SMTP verification failed:', error.message);
    if (error.message.includes('Invalid login')) {
      console.error('🔑 Check your EMAIL_USER and EMAIL_PASSWORD credentials');
    }
    process.exit(1);
  }
  
  // 4. Create test email content (similar to registration email)
  console.log('📋 Step 4: Creating test registration email...');
  const testUser = {
    email: 'test@example.com', // Change this to your email for testing
    firstName: 'Test',
    verificationLink: 'https://mash-backend-api-production.up.railway.app/verify?token=test123'
  };
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your MASH Account</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px;">Welcome to MASH! 🍄</h1>
                </td>
              </tr>
              
              <!-- Body -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; color: #2c3e50; font-size: 24px;">Hi ${testUser.firstName}!</h2>
                  
                  <p style="margin: 0 0 20px 0; color: #555; font-size: 16px; line-height: 1.6;">
                    Thank you for registering with <strong>MASH - Mushroom Automation Smart Harvesting</strong>!
                  </p>
                  
                  <p style="margin: 0 0 30px 0; color: #555; font-size: 16px; line-height: 1.6;">
                    Please verify your email address by clicking the button below:
                  </p>
                  
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="${testUser.verificationLink}" 
                           style="display: inline-block; padding: 15px 40px; background-color: #2ecc71; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                          Verify Email Address
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 20px 0 0 0; color: #777; font-size: 14px; line-height: 1.6;">
                    If you didn't create an account with MASH, please ignore this email.
                  </p>
                  
                  <p style="margin: 20px 0 0 0; color: #777; font-size: 14px; line-height: 1.6;">
                    This verification link expires in <strong>24 hours</strong>.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                  <p style="margin: 0 0 10px 0; color: #999; font-size: 14px;">
                    © ${new Date().getFullYear()} MASH - Mushroom Automation Smart Harvesting
                  </p>
                  <p style="margin: 0; color: #999; font-size: 12px;">
                    Automated mushroom cultivation monitoring system
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
  
  const textContent = `
Hi ${testUser.firstName}!

Thank you for registering with MASH - Mushroom Automation Smart Harvesting!

Please verify your email address by visiting this link:
${testUser.verificationLink}

If you didn't create an account with MASH, please ignore this email.

This verification link expires in 24 hours.

© ${new Date().getFullYear()} MASH - Mushroom Automation Smart Harvesting
Automated mushroom cultivation monitoring system
  `.trim();
  
  console.log('✅ Test email content created\n');
  
  // 5. Send test email
  console.log('📋 Step 5: Sending test registration email...');
  console.log(`📧 To: ${testUser.email}`);
  console.log(`📧 From: ${process.env.EMAIL_FROM}\n`);
  
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: testUser.email, // Change this to your actual email
      subject: '✅ Verify Your MASH Account - Registration Confirmation',
      text: textContent,
      html: htmlContent,
    });
    
    console.log('✅ TEST EMAIL SENT SUCCESSFULLY!');
    console.log(`📬 Message ID: ${info.messageId}`);
    console.log(`📨 Accepted: ${info.accepted.join(', ')}`);
    if (info.rejected.length > 0) {
      console.log(`❌ Rejected: ${info.rejected.join(', ')}`);
    }
    
    console.log('\n🎉 Registration email test completed successfully!');
    console.log('📬 Please check the inbox of:', testUser.email);
    
  } catch (error) {
    console.error('\n❌ Failed to send test email:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testRegistrationEmail().catch(console.error);
