import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

/**
 * Firebase Passport Strategy for token validation
 *
 * Note: Firebase Admin SDK is initialized by FirebaseModule/FirebaseConfigService.
 * This strategy only validates tokens using the already-initialized SDK.
 */
@Injectable()
export class FirebaseStrategy extends PassportStrategy(Strategy, 'firebase') {
  constructor(private configService: ConfigService) {
    super();
    // Firebase initialization is handled by FirebaseModule
    if (!admin.apps.length) {
      console.warn(
        '⚠️ FirebaseStrategy: Firebase Admin SDK not initialized. ' +
          'Ensure FirebaseModule is imported before AuthModule.',
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
