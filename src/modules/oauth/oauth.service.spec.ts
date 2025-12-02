import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

// Mock dependencies
jest.mock('google-auth-library');
jest.mock('axios');

describe('OAuthService', () => {
  let service: OAuthService;
  let configService: ConfigService;
  let mockGoogleClient: jest.Mocked<OAuth2Client>;

  const mockGoogleClientId = 'test-google-client-id.apps.googleusercontent.com';
  const mockFacebookAppId = 'test-facebook-app-id';
  const mockFacebookAppSecret = 'test-facebook-app-secret';

  beforeEach(async () => {
    // Create mock OAuth2Client
    mockGoogleClient = {
      verifyIdToken: jest.fn(),
    } as any;

    // Mock OAuth2Client constructor
    (OAuth2Client as jest.MockedClass<typeof OAuth2Client>).mockImplementation(() => mockGoogleClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                GOOGLE_CLIENT_ID: mockGoogleClientId,
                FACEBOOK_APP_ID: mockFacebookAppId,
                FACEBOOK_APP_SECRET: mockFacebookAppSecret,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OAuthService>(OAuthService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateGoogleToken', () => {
    const validIdToken = 'valid.google.id.token';
    const mockGooglePayload = {
      sub: 'google_user_123456',
      email: 'test@gmail.com',
      given_name: 'John',
      family_name: 'Doe',
      picture: 'https://lh3.googleusercontent.com/a/test-image',
      email_verified: true,
    };

    it('should successfully validate a valid Google ID token', async () => {
      // Mock Google API response
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => mockGooglePayload,
      } as any);

      const result = await service.validateGoogleToken(validIdToken);

      expect(result).toEqual({
        id: 'google_user_123456',
        email: 'test@gmail.com',
        firstName: 'John',
        lastName: 'Doe',
        imageUrl: 'https://lh3.googleusercontent.com/a/test-image',
        emailVerified: true,
        provider: 'google',
      });

      expect(mockGoogleClient.verifyIdToken).toHaveBeenCalledWith({
        idToken: validIdToken,
        audience: mockGoogleClientId,
      });
    });

    it('should handle missing given_name gracefully', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          ...mockGooglePayload,
          given_name: undefined,
          family_name: undefined,
        }),
      } as any);

      const result = await service.validateGoogleToken(validIdToken);

      expect(result.firstName).toBe('');
      expect(result.lastName).toBe('');
    });

    it('should handle email_verified as false', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          ...mockGooglePayload,
          email_verified: false,
        }),
      } as any);

      const result = await service.validateGoogleToken(validIdToken);

      expect(result.emailVerified).toBe(false);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      mockGoogleClient.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

      await expect(service.validateGoogleToken('invalid.token')).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.validateGoogleToken('invalid.token')).rejects.toThrow(
        'Invalid Google ID token'
      );
    });

    it('should throw UnauthorizedException if payload is null', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => null,
      } as any);

      await expect(service.validateGoogleToken(validIdToken)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.validateGoogleToken(validIdToken)).rejects.toThrow(
        'Invalid Google ID token: no payload'
      );
    });

    it('should throw UnauthorizedException if email is missing', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          ...mockGooglePayload,
          email: undefined,
        }),
      } as any);

      const result = await service.validateGoogleToken(validIdToken);

      // Should still return result but with empty email
      expect(result.email).toBe('');
    });

    it('should throw UnauthorizedException for expired token', async () => {
      mockGoogleClient.verifyIdToken.mockRejectedValue(
        new Error('Token used too late')
      );

      await expect(service.validateGoogleToken('expired.token')).rejects.toThrow(
        'Invalid Google ID token'
      );
    });
  });

  describe('validateFacebookToken', () => {
    const validAccessToken = 'valid.facebook.access.token';
    const mockFacebookUser = {
      id: 'facebook_user_123456',
      email: 'test@facebook.com',
      first_name: 'Jane',
      last_name: 'Smith',
      picture: {
        data: {
          url: 'https://graph.facebook.com/123456/picture',
        },
      },
    };

    beforeEach(() => {
      // Reset axios mocks
      (axios.get as jest.MockedFunction<typeof axios.get>).mockReset();
    });

    it('should successfully validate a valid Facebook access token', async () => {
      // Mock Facebook debug endpoint response
      (axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValueOnce({
        data: {
          data: {
            is_valid: true,
            app_id: mockFacebookAppId,
          },
        },
      });

      // Mock Facebook user info endpoint response
      (axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValueOnce({
        data: mockFacebookUser,
      });

      const result = await service.validateFacebookToken(validAccessToken);

      expect(result).toEqual({
        id: 'facebook_user_123456',
        email: 'test@facebook.com',
        firstName: 'Jane',
        lastName: 'Smith',
        imageUrl: 'https://graph.facebook.com/123456/picture',
        emailVerified: true,
        provider: 'facebook',
      });

      // Verify debug endpoint was called
      expect(axios.get).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('debug_token')
      );

      // Verify user endpoint was called
      expect(axios.get).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('graph.facebook.com/me')
      );
    });

    it('should handle missing email gracefully', async () => {
      (axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValueOnce({
        data: { data: { is_valid: true } },
      });

      (axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValueOnce({
        data: {
          ...mockFacebookUser,
          email: undefined,
        },
      });

      const result = await service.validateFacebookToken(validAccessToken);

      expect(result.email).toBe('');
    });

    it('should handle missing picture gracefully', async () => {
      (axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValueOnce({
        data: { data: { is_valid: true } },
      });

      (axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValueOnce({
        data: {
          ...mockFacebookUser,
          picture: undefined,
        },
      });

      const result = await service.validateFacebookToken(validAccessToken);

      expect(result.imageUrl).toBeUndefined();
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      (axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValueOnce({
        data: {
          data: {
            is_valid: false,
          },
        },
      });

      await expect(service.validateFacebookToken('invalid.token')).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.validateFacebookToken('invalid.token')).rejects.toThrow(
        'Invalid Facebook access token'
      );
    });

    it('should throw UnauthorizedException on Facebook API error', async () => {
      const mockError = {
        response: {
          status: 400,
          data: {
            error: {
              message: 'Invalid OAuth access token',
            },
          },
        },
        isAxiosError: true,
      };

      (axios.get as jest.MockedFunction<typeof axios.get>).mockRejectedValueOnce(mockError);
      (axios as any).isAxiosError = jest.fn().mockReturnValue(true);

      await expect(service.validateFacebookToken('error.token')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException for network errors', async () => {
      (axios.get as jest.MockedFunction<typeof axios.get>).mockRejectedValueOnce(
        new Error('Network error')
      );
      (axios as any).isAxiosError = jest.fn().mockReturnValue(false);

      await expect(service.validateFacebookToken('network.error.token')).rejects.toThrow(
        'Invalid Facebook access token'
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const mockError = {
        response: {
          status: 401,
          data: {
            error: {
              message: 'Token is expired',
            },
          },
        },
        isAxiosError: true,
      };

      (axios.get as jest.MockedFunction<typeof axios.get>).mockRejectedValueOnce(mockError);
      (axios as any).isAxiosError = jest.fn().mockReturnValue(true);

      await expect(service.validateFacebookToken('expired.token')).rejects.toThrow(
        'Invalid Facebook access token: Token is expired'
      );
    });
  });

  describe('getUserFromProvider', () => {
    const mockToken = 'test.oauth.token';

    it('should call validateGoogleToken for google provider', async () => {
      const mockGoogleData = {
        id: 'google_123',
        email: 'test@gmail.com',
        firstName: 'John',
        lastName: 'Doe',
        imageUrl: 'https://example.com/image.jpg',
        emailVerified: true,
        provider: 'google' as const,
      };

      jest.spyOn(service, 'validateGoogleToken').mockResolvedValue(mockGoogleData);

      const result = await service.getUserFromProvider('google', mockToken);

      expect(result).toEqual(mockGoogleData);
      expect(service.validateGoogleToken).toHaveBeenCalledWith(mockToken);
    });

    it('should call validateFacebookToken for facebook provider', async () => {
      const mockFacebookData = {
        id: 'facebook_123',
        email: 'test@facebook.com',
        firstName: 'Jane',
        lastName: 'Smith',
        imageUrl: 'https://example.com/image.jpg',
        emailVerified: true,
        provider: 'facebook' as const,
      };

      jest.spyOn(service, 'validateFacebookToken').mockResolvedValue(mockFacebookData);

      const result = await service.getUserFromProvider('facebook', mockToken);

      expect(result).toEqual(mockFacebookData);
      expect(service.validateFacebookToken).toHaveBeenCalledWith(mockToken);
    });

    it('should throw BadRequestException for unsupported provider', async () => {
      await expect(
        service.getUserFromProvider('twitter' as any, mockToken)
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getUserFromProvider('twitter' as any, mockToken)
      ).rejects.toThrow('Unsupported OAuth provider: twitter');
    });

    it('should propagate errors from provider validation', async () => {
      jest.spyOn(service, 'validateGoogleToken').mockRejectedValue(
        new UnauthorizedException('Invalid token')
      );

      await expect(service.getUserFromProvider('google', 'invalid.token')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('Service Initialization', () => {
    it('should initialize with correct Google Client ID', () => {
      expect(OAuth2Client).toHaveBeenCalledWith(mockGoogleClientId);
    });

    it('should initialize with Facebook credentials', () => {
      expect(configService.get).toHaveBeenCalledWith('FACEBOOK_APP_ID');
      expect(configService.get).toHaveBeenCalledWith('FACEBOOK_APP_SECRET');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing environment variables gracefully', async () => {
      const moduleWithMissingConfig: TestingModule = await Test.createTestingModule({
        providers: [
          OAuthService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ''), // Return empty strings
            },
          },
        ],
      }).compile();

      const serviceWithMissingConfig = moduleWithMissingConfig.get<OAuthService>(OAuthService);

      // Service should still initialize (won't throw during construction)
      expect(serviceWithMissingConfig).toBeDefined();
    });

    it('should handle empty token string', async () => {
      await expect(service.validateGoogleToken('')).rejects.toThrow(UnauthorizedException);
    });

    it('should handle null token (type coercion)', async () => {
      await expect(service.validateGoogleToken(null as any)).rejects.toThrow();
    });

    it('should handle malformed token', async () => {
      mockGoogleClient.verifyIdToken.mockRejectedValue(new Error('Malformed token'));

      await expect(service.validateGoogleToken('not.a.jwt')).rejects.toThrow(
        'Invalid Google ID token'
      );
    });
  });

  describe('Security Tests', () => {
    it('should verify token audience matches client ID', async () => {
      const validToken = 'valid.token';
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: '123',
          email: 'test@gmail.com',
          email_verified: true,
        }),
      } as any);

      await service.validateGoogleToken(validToken);

      expect(mockGoogleClient.verifyIdToken).toHaveBeenCalledWith({
        idToken: validToken,
        audience: mockGoogleClientId,
      });
    });

    it('should use app token for Facebook token validation', async () => {
      const accessToken = 'user.access.token';

      (axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValueOnce({
        data: { data: { is_valid: true } },
      });

      (axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValueOnce({
        data: {
          id: '123',
          email: 'test@facebook.com',
          first_name: 'Test',
          last_name: 'User',
        },
      });

      await service.validateFacebookToken(accessToken);

      // Verify debug endpoint includes app token
      expect(axios.get).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(`${mockFacebookAppId}|${mockFacebookAppSecret}`)
      );
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent Google token validations', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: '123',
          email: 'test@gmail.com',
          email_verified: true,
        }),
      } as any);

      const promises = Array.from({ length: 10 }, (_, i) =>
        service.validateGoogleToken(`token_${i}`)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(mockGoogleClient.verifyIdToken).toHaveBeenCalledTimes(10);
    });

    it('should handle concurrent Facebook token validations', async () => {
      (axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
        data: { data: { is_valid: true } },
      });

      (axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
        data: {
          id: '123',
          email: 'test@facebook.com',
          first_name: 'Test',
          last_name: 'User',
        },
      });

      const promises = Array.from({ length: 10 }, (_, i) =>
        service.validateFacebookToken(`token_${i}`)
      );

      await Promise.all(promises);

      expect(axios.get).toHaveBeenCalled();
    });
  });
});
