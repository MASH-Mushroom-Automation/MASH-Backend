import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthenticatedSocket, SocketUser } from '../interfaces/authenticated-socket.interface';

/**
 * WebSocket JWT Authentication Guard
 * Validates JWT tokens and attaches user information to the socket
 * Supports multiple token sources: auth object, headers, query params
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Validate the connection and attach user data to socket
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = this.extractToken(client);

      if (!token) {
        throw new WsException('Missing authentication token');
      }

      // Validate JWT token
      const payload = await this.validateToken(token);
      
      // Attach user information to socket
      (client as AuthenticatedSocket).user = this.extractUserFromPayload(payload);
      (client as AuthenticatedSocket).lastActivity = Date.now();
      (client as AuthenticatedSocket).subscriptions = new Set();

      this.logger.debug(
        `WebSocket authentication successful for user: ${(client as AuthenticatedSocket).user.id}`,
      );

      return true;
    } catch (error) {
      this.logger.error(`WebSocket authentication failed: ${error.message}`);
      throw new WsException(error.message || 'Authentication failed');
    }
  }

  /**
   * Extract token from various sources in priority order
   * 1. auth.token (recommended)
   * 2. Authorization header
   * 3. Query parameter (less secure, for compatibility)
   */
  private extractToken(client: Socket): string | null {
    // Method 1: Auth object (recommended for Socket.IO)
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }

    // Method 2: Authorization header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        return parts[1];
      }
      // Support simple token without Bearer prefix
      return authHeader;
    }

    // Method 3: Query parameter (fallback)
    if (client.handshake.query?.token) {
      return client.handshake.query.token as string;
    }

    return null;
  }

  /**
   * Validate JWT token and return payload
   */
  private async validateToken(token: string): Promise<any> {
    try {
      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      // Check if token is expired
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        throw new Error('Token has expired');
      }

      return payload;
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      }
      throw error;
    }
  }

  /**
   * Extract user information from JWT payload
   */
  private extractUserFromPayload(payload: any): SocketUser {
    // Support both standard JWT claims and custom structures
    return {
      id: payload.sub || payload.userId || payload.id,
      email: payload.email,
      roles: payload.roles || ['user'],
      name: payload.name || payload.username,
      firebaseUid: payload.firebase_uid || payload.uid,
    };
  }
}

/**
 * Optional: Firebase Token Guard (for Firebase authentication support)
 * Uncomment and implement if you need Firebase authentication
 */
/*
import * as admin from 'firebase-admin';

@Injectable()
export class WsFirebaseGuard implements CanActivate {
  private readonly logger = new Logger(WsFirebaseGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = this.extractToken(client);

      if (!token) {
        throw new WsException('Missing authentication token');
      }

      // Validate Firebase token
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Attach user information to socket
      (client as AuthenticatedSocket).user = {
        id: decodedToken.uid,
        email: decodedToken.email,
        roles: decodedToken.roles || ['user'],
        name: decodedToken.name,
        firebaseUid: decodedToken.uid,
      };

      return true;
    } catch (error) {
      this.logger.error(`Firebase authentication failed: ${error.message}`);
      throw new WsException('Authentication failed');
    }
  }

  private extractToken(client: Socket): string | null {
    return client.handshake.auth?.token || 
           client.handshake.headers.authorization?.replace('Bearer ', '') ||
           (client.handshake.query?.token as string);
  }
}
*/
