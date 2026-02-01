import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env variables immediately
dotenv.config();

// --- Standalone Firebase Initialization ---
// This runs once when the module is loaded, before NestJS instantiates any classes.
// It bypasses any potential lifecycle issues with ConfigService.
if (!admin.apps.length) {
  try {
    const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');

    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(`Firebase service account file not found at: ${serviceAccountPath}`);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL, // Read directly from process.env
    });

    console.log('✅✅✅ Firebase Admin SDK Initialized Successfully (Standalone Method) ✅✅✅');
  } catch (error) {
    console.error('🔥🔥🔥 FATAL: STANDALONE FIREBASE INITIALIZATION FAILED 🔥🔥🔥', error);
  }
}

@Injectable()
export class FirebaseStrategy extends PassportStrategy(Strategy, 'firebase') {
  constructor(private configService: ConfigService) {
    super();
    // The constructor is now empty. Initialization happens above.
    if (!admin.apps.length) {
      console.error(
        'CRITICAL: FirebaseStrategy constructor ran, but Firebase app was not initialized.',
      );
    }
  }

  async validate(req: Request): Promise<any> {
    const authHeader = req.headers?.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(String(token));
      return {
        uid: (decodedToken as any).uid,
        email: (decodedToken as any).email,
        emailVerified: (decodedToken as any).email_verified,
        firebaseUser: decodedToken,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }
  }
}
