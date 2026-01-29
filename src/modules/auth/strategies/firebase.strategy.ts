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

    // Initialize Firebase Admin SDK only when credentials are present and valid
    if (!admin.apps.length) {
      const projectId = String(this.configService.get('FIREBASE_PROJECT_ID') || '');
      const clientEmail = String(this.configService.get('FIREBASE_CLIENT_EMAIL') || '');
      const rawPrivateKey = String(this.configService.get('FIREBASE_PRIVATE_KEY') || '');

      if (projectId.length > 0 && clientEmail.length > 0 && rawPrivateKey.length > 0) {
        // Robust Private Key Formatting:
        // Handle both actual newlines (from template literals or correct env parsing)
        // AND literal "\n" strings (common dotenv issue)
        let privateKey = rawPrivateKey;

        // If it contains literal "\n" characters, replace them with real newlines
        if (privateKey.includes('\\n')) {
          privateKey = privateKey.replace(/\\n/g, '\n');
        }

        // Remove surrounding quotes if they were included in the value
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
          privateKey = privateKey.slice(1, -1);
        }

        try {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId,
              clientEmail,
              privateKey,
            }),
            databaseURL: this.configService.get('FIREBASE_DATABASE_URL'),
          });
          console.warn('✅ Firebase Admin SDK initialized');
        } catch (err) {
          // If the private key is malformed, log a warning and continue without Firebase
          const message = (err && (err as Error).message) || String(err);
          console.warn(
            '⚠️ Firebase Admin SDK initialization failed - proceeding without Firebase authentication. Error:',
            message,
          );
        }
      } else {
        console.warn('⚠️ Firebase credentials not provided - Firebase authentication disabled');
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
