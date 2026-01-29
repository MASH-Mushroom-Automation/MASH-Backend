import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testCreds() {
  console.log('🔍 Testing Firebase Credentials...');
  console.log(`Project ID: ${process.env.FIREBASE_PROJECT_ID}`);
  console.log(`Client Email: ${process.env.FIREBASE_CLIENT_EMAIL}`);

  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ FIREBASE_PRIVATE_KEY is missing');
    return;
  }

  console.log(`Private Key Length: ${privateKey.length}`);
  console.log(`Private Key Start: ${privateKey.substring(0, 50)}...`);

  // Initialize
  try {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    }
    console.log('✅ Firebase Admin Initialized');

    // Create a custom token (requires valid private key)
    const uid = 'test-user-123';
    console.log('🔄 Attempting to sign a custom token...');
    const token = await admin.auth().createCustomToken(uid);
    console.log('✅ Token Signed Successfully! Credentials are VALID.');
    console.log('Token preview:', token.substring(0, 50) + '...');
  } catch (error) {
    console.error('❌ Credential Test Failed:');
    console.error(error);
  }
}

testCreds();
