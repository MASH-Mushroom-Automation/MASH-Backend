const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

// SMTP transporter configuration (Gmail)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false, // Allow self-signed certificates (for development)
  },
});

// Verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Transporter Error:', error.message);
    console.error('Check your EMAIL_USER and EMAIL_PASSWORD in .env');
  } else {
    console.log('✅ SMTP Relay is ready to send emails');
    console.log(`📧 Configured for: ${process.env.EMAIL_USER}`);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mash-smtp-relay',
    timestamp: new Date().toISOString(),
    configured: !!process.env.EMAIL_USER,
  });
});

// Email sending endpoint
app.post('/send-email', async (req, res) => {
  const { to, subject, html, text, from, cc, bcc, attachments } = req.body;

  // Validation
  if (!to || !subject) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: to, subject',
    });
  }

  try {
    console.log(`📧 [${new Date().toISOString()}] Sending email to: ${to}`);
    console.log(`   Subject: ${subject}`);

    const mailOptions = {
      from: from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html: html || text,
      text: text || html?.replace(/<[^>]*>/g, ''), // Strip HTML for text fallback
    };

    // Optional fields
    if (cc) mailOptions.cc = cc;
    if (bcc) mailOptions.bcc = bcc;
    if (attachments) mailOptions.attachments = attachments;

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);

    res.json({
      success: true,
      messageId: info.messageId,
      response: info.response,
    });
  } catch (error) {
    console.error(`❌ Email send error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);

    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
    });
  }
});

// Batch email sending endpoint (for bulk operations)
app.post('/send-bulk', async (req, res) => {
  const { emails } = req.body;

  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'emails must be a non-empty array',
    });
  }

  console.log(`📧 Processing bulk email send: ${emails.length} emails`);

  const results = [];
  const errors = [];

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    try {
      const info = await transporter.sendMail({
        from: email.from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email.to,
        subject: email.subject,
        html: email.html || email.text,
        text: email.text,
      });

      results.push({
        index: i,
        to: email.to,
        success: true,
        messageId: info.messageId,
      });

      console.log(`✅ [${i + 1}/${emails.length}] Sent to: ${email.to}`);
    } catch (error) {
      errors.push({
        index: i,
        to: email.to,
        success: false,
        error: error.message,
      });

      console.error(`❌ [${i + 1}/${emails.length}] Failed: ${email.to} - ${error.message}`);
    }
  }

  res.json({
    success: errors.length === 0,
    total: emails.length,
    sent: results.length,
    failed: errors.length,
    results,
    errors,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
const PORT = process.env.RELAY_PORT || 2525;
app.listen(PORT, () => {
  console.log('\n🚀 ================================');
  console.log(`🚀 SMTP Relay Server is running!`);
  console.log(`🚀 ================================`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📧 Email: ${process.env.EMAIL_USER || 'NOT CONFIGURED'}`);
  console.log(`🔧 Host: ${process.env.EMAIL_HOST || 'smtp.gmail.com'}`);
  console.log(`\n📝 Endpoints:`);
  console.log(`   GET  /health       - Health check`);
  console.log(`   POST /send-email   - Send single email`);
  console.log(`   POST /send-bulk    - Send multiple emails`);
  console.log(`\n💡 Start ngrok tunnel: ngrok http ${PORT} --region ap`);
  console.log(`================================\n`);
});
