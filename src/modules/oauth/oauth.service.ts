import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import { OAuthUserData, OAuthProvider } from './interfaces/oauth-user.interface';

/**
 * OAuth Service
 * Handles token validation for Google and Facebook OAuth providers
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly googleClient: OAuth2Client;
  private readonly facebookAppId: string;
  private readonly facebookAppSecret: string;

  constructor(private configService: ConfigService) {
    // Initialize Google OAuth2 Client
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(googleClientId);

    // Store Facebook credentials
    this.facebookAppId = this.configService.get<string>('FACEBOOK_APP_ID') || '';
    this.facebookAppSecret = this.configService.get<string>('FACEBOOK_APP_SECRET') || '';

    this.logger.log('OAuth Service initialized');
  }

  /**
   * Validate Google ID Token
   * Verifies token with Google OAuth API and extracts user data
   * 
   * @param idToken - Google ID token (JWT format)
   * @returns Normalized OAuth user data
   * @throws UnauthorizedException if token is invalid
   */
  async validateGoogleToken(idToken: string): Promise<OAuthUserData> {
    try {
      this.logger.log('Validating Google ID token...');

      // Verify token with Google
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new UnauthorizedException('Invalid Google ID token: no payload');
      }

      // Extract user data
      const userData: OAuthUserData = {
        id: payload.sub, // Google user ID
        email: payload.email || '',
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
        imageUrl: payload.picture,
        emailVerified: payload.email_verified || false,
        provider: 'google',
      };

      this.logger.log(`Google token validated for user: ${userData.email}`);
      return userData;
    } catch (error) {
      this.logger.error('Failed to validate Google token:', error);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new UnauthorizedException('Invalid Google ID token');
    }
  }

  /**
   * Validate Facebook Access Token
   * Verifies token with Facebook Graph API and fetches user data
   * 
   * @param accessToken - Facebook access token
   * @returns Normalized OAuth user data
   * @throws UnauthorizedException if token is invalid
   */
  async validateFacebookToken(accessToken: string): Promise<OAuthUserData> {
    try {
      this.logger.log('Validating Facebook access token...');

      // Step 1: Verify token with Facebook debug endpoint
      const appToken = `${this.facebookAppId}|${this.facebookAppSecret}`;
      const debugUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${appToken}`;

      const debugResponse = await axios.get(debugUrl);

      if (!debugResponse.data.data.is_valid) {
        throw new UnauthorizedException('Invalid Facebook access token');
      }

      // Step 2: Fetch user data from Facebook Graph API
      const userUrl = `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture.type(large)&access_token=${accessToken}`;

      const userResponse = await axios.get(userUrl);
      const fbUser = userResponse.data;

      // Extract user data
      const userData: OAuthUserData = {
        id: fbUser.id,
        email: fbUser.email || '',
        firstName: fbUser.first_name || '',
        lastName: fbUser.last_name || '',
        imageUrl: fbUser.picture?.data?.url,
        emailVerified: true, // Facebook users have verified emails
        provider: 'facebook',
      };

      this.logger.log(`Facebook token validated for user: ${userData.email}`);
      return userData;
    } catch (error) {
      this.logger.error('Failed to validate Facebook token:', error);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || 'Facebook API error';
        
        this.logger.error(`Facebook API error (${status}): ${message}`);
        throw new UnauthorizedException(`Invalid Facebook access token: ${message}`);
      }

      throw new UnauthorizedException('Invalid Facebook access token');
    }
  }

  /**
   * Get user data from OAuth provider
   * Wrapper method that routes to appropriate provider
   * 
   * @param provider - OAuth provider ('google' | 'facebook')
   * @param token - OAuth token (ID token for Google, access token for Facebook)
   * @returns Normalized OAuth user data
   */
  async getUserFromProvider(provider: OAuthProvider, token: string): Promise<OAuthUserData> {
    if (provider === 'google') {
      return this.validateGoogleToken(token);
    } else if (provider === 'facebook') {
      return this.validateFacebookToken(token);
    } else {
      throw new BadRequestException(`Unsupported OAuth provider: ${provider}`);
    }
  }
}
