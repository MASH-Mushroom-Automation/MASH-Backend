import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface TokenPayload {
  sub: string; // User ID
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Generate access token
   */
  generateAccessToken(payload: Omit<TokenPayload, 'type'>): string {
    return this.jwtService.sign(
      {
        ...payload,
        type: 'access',
      },
      {
        secret: this.configService.get<string>('JWT_SECRET') ?? '',
        expiresIn: (this.configService.get<string>('clerk.sessionDuration') ??
          '24h') as number | `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
    return this.jwtService.sign(
      {
        ...payload,
        type: 'refresh',
      },
      {
        secret: this.configService.get<string>('JWT_SECRET') ?? '',
        expiresIn: (this.configService.get<string>(
          'clerk.refreshTokenDuration',
        ) ?? '7d') as number | `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(payload: Omit<TokenPayload, 'type'>) {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
      expiresIn: this.parseExpiresIn(
        this.configService.get<string>('clerk.sessionDuration') || '7d',
      ),
    };
  }

  /**
   * Verify and decode token
   */
  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET') ?? '',
      });
      return payload;
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      throw new Error('Invalid token');
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): any {
    return this.jwtService.decode(token);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded: any = this.jwtService.decode(token);
      if (!decoded || !decoded.exp) return true;

      const now = Math.floor(Date.now() / 1000);
      return decoded.exp < now;
    } catch {
      return true;
    }
  }

  /**
   * Parse expiration time to seconds
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60; // Default 7 days

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 7 * 24 * 60 * 60;
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authorization?: string): string | null {
    if (!authorization) return null;

    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
