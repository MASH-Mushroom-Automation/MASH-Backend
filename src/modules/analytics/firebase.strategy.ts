import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseStrategy extends PassportStrategy(Strategy, 'firebase') {
  constructor(private configService: ConfigService) {
    super();

    // Initialize Firebase Admin SDK.
    // It will automatically find and use the GOOGLE_APPLICATION_CREDENTIALS
    // environment variable (the path to the JSON file).
    if (!admin.apps.length) {
      const serviceAccountJson = this.configService.get<string>(
        'GOOGLE_APPLICATION_CREDENTIALS_JSON',
      );

      try {
        if (serviceAccountJson) {
          // Production: Initialize from JSON string in environment variable
          const serviceAccount = JSON.parse(serviceAccountJson);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: this.configService.get('FIREBASE_DATABASE_URL'),
          });
          console.warn('✅ Firebase Admin SDK initialized from JSON environment variable.');
        } else {
          // Development: Initialize from file path
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            databaseURL: this.configService.get('FIREBASE_DATABASE_URL'),
          });
          console.warn(
            '✅ Firebase Admin SDK initialized from file path (GOOGLE_APPLICATION_CREDENTIALS).',
          );
        }
      } catch (err) {
        const message = (err && (err as Error).message) || String(err);
        console.warn(
          '⚠️ Firebase Admin SDK initialization failed. Check GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS_JSON.',
          message,
        );
      }
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
