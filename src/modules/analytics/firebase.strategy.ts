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

    // The SDK is initialized in the primary AuthModule's FirebaseStrategy.
    // This strategy is now a passive consumer.
    if (!admin.apps.length) {
      // This log indicates a problem with module loading order.
      // The AuthModule should always be loaded first.
      console.error(
        '🔥🔥🔥 FATAL: FirebaseStrategy in AnalyticsModule ran before AuthModule. Check module import order. 🔥🔥🔥',
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
