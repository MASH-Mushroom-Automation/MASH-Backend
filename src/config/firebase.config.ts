import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// --- Standalone Firebase Initialization ---
// This runs ONCE when the module is loaded, before NestJS instantiates any classes.
// This is critical because NestJS providers are instantiated before lifecycle hooks run.
const logger = new Logger('FirebaseInit');

if (!admin.apps.length) {
  try {
    const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');

    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });

      logger.log('✅ Firebase Admin SDK initialized from service account file');
    } else {
      // Try environment variables
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
          databaseURL: process.env.FIREBASE_DATABASE_URL,
        });

        logger.log('✅ Firebase Admin SDK initialized from environment variables');
      } else {
        logger.warn(
          '⚠️ Firebase Admin SDK NOT initialized: No credentials found. ' +
            'Firebase authentication features will not work.',
        );
      }
    }
  } catch (error) {
    logger.error('❌ Firebase Admin SDK initialization failed:', error);
  }
}

/**
 * Firebase Admin SDK Configuration Service
 *
 * This service provides access to the Firebase Admin SDK.
 * The SDK is initialized at module load time (see above) to ensure
 * it's available before any NestJS providers are instantiated.
 */
@Injectable()
export class FirebaseConfigService {
  private readonly logger = new Logger(FirebaseConfigService.name);

  constructor(private readonly configService: ConfigService) {
    // Firebase is already initialized at module load time
    if (admin.apps.length > 0) {
      this.logger.log('✅ Firebase Admin SDK is available');
    } else {
      this.logger.warn('⚠️ Firebase Admin SDK is NOT available');
    }
  }

  /**
   * Check if Firebase is initialized
   */
  isInitialized(): boolean {
    return admin.apps.length > 0;
  }

  /**
   * Get Firebase Auth instance
   */
  getAuth(): admin.auth.Auth {
    if (!this.isInitialized()) {
      throw new Error('Firebase Admin SDK is not initialized');
    }
    return admin.auth();
  }
}
