import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsService, SMSMessage, SMSDeliveryResult } from './services/sms.service';

// Mock Twilio
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  }));
});

// Mock Vonage
jest.mock('@vonage/server-sdk', () => ({
  Vonage: jest.fn().mockImplementation(() => ({
    sms: {
      send: jest.fn(),
    },
  })),
}));

describe('SmsService', () => {
  let service: SmsService;
  let configService: ConfigService;
  let mockTwilioClient: any;
  let mockVonageClient: any;

  const mockConfig = {
    TWILIO_ACCOUNT_SID: 'test_twilio_sid',
    TWILIO_AUTH_TOKEN: 'test_twilio_token',
    TWILIO_PHONE_NUMBER: '+1234567890',
    VONAGE_API_KEY: 'test_vonage_key',
    VONAGE_API_SECRET: 'test_vonage_secret',
    VONAGE_PHONE_NUMBER: '+0987654321',
    SMS_PROVIDER_PRIORITY: 'twilio,vonage',
    SMS_RATE_LIMIT_PER_MINUTE: 10,
    SMS_DELIVERY_TIMEOUT: 30000,
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
    configService = module.get<ConfigService>(ConfigService);

    // Get the mocked clients from the service
    mockTwilioClient = (service as any).twilioClient;
    mockVonageClient = (service as any).vonageClient;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Initialization', () => {
    it('should initialize Twilio client when credentials are provided', () => {
      expect(mockTwilioClient).toBeDefined();
    });

    it('should initialize Vonage client when credentials are provided', () => {
      expect(mockVonageClient).toBeDefined();
    });

    it('should set provider priority from config', () => {
      const priority = (service as any).providerPriority;
      expect(priority).toEqual(['twilio', 'vonage']);
    });

    it('should initialize provider health status', () => {
      const health = service.getProviderHealth();
      expect(health).toHaveLength(2);
      expect(health.find(h => h.provider === 'twilio')).toBeDefined();
      expect(health.find(h => h.provider === 'vonage')).toBeDefined();
    });
  });

  describe('sendSMS', () => {
    const validMessage: SMSMessage = {
      to: '+1234567890',
      body: 'Test message',
    };

    it('should validate required fields', async () => {
      const invalidMessage = { to: '', body: '' };
      const result = await service.sendSMS(invalidMessage as SMSMessage);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields: to and body');
      expect(result.status).toBe('failed');
    });

    it('should send SMS successfully via Twilio (first priority)', async () => {
      const mockTwilioResponse = {
        sid: 'SM1234567890',
        status: 'sent',
        price: '0.0075',
      };

      mockTwilioClient.messages.create.mockResolvedValue(mockTwilioResponse);

      const result = await service.sendSMS(validMessage);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SM1234567890');
      expect(result.provider).toBe('twilio');
      expect(result.cost).toBe(0.0075);
      expect(result.status).toBe('sent');
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: 'Test message',
        from: '+1234567890',
        to: '+1234567890',
      });
    });

    it('should failover to Vonage when Twilio fails', async () => {
      // Twilio fails
      mockTwilioClient.messages.create.mockRejectedValue(new Error('Twilio error'));

      // Vonage succeeds
      const mockVonageResponse = {
        messages: [
          {
            status: '0',
            'message-id': 'VM1234567890',
          },
        ],
      };

      mockVonageClient.sms.send.mockResolvedValue(mockVonageResponse);

      const result = await service.sendSMS(validMessage);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('VM1234567890');
      expect(result.provider).toBe('vonage');
      expect(result.status).toBe('sent');
    });

    it('should return failure when all providers fail', async () => {
      mockTwilioClient.messages.create.mockRejectedValue(new Error('Twilio error'));
      mockVonageClient.sms.send.mockRejectedValue(new Error('Vonage error'));

      const result = await service.sendSMS(validMessage);

      expect(result.success).toBe(false);
      expect(result.error).toBe('All SMS providers failed');
      expect(result.status).toBe('failed');
    });

    it('should update provider health on success', async () => {
      const mockTwilioResponse = {
        sid: 'SM1234567890',
        status: 'sent',
        price: '0.0075',
      };

      mockTwilioClient.messages.create.mockImplementation(async () => {
        // Simulate some delay
        await new Promise(resolve => setTimeout(resolve, 10));
        return mockTwilioResponse;
      });

      await service.sendSMS(validMessage);

      const health = service.getProviderHealth();
      const twilioHealth = health.find(h => h.provider === 'twilio');
      expect(twilioHealth?.healthy).toBe(true);
      expect(twilioHealth?.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should update provider health on failure', async () => {
      mockTwilioClient.messages.create.mockRejectedValue(new Error('Twilio error'));

      await service.sendSMS(validMessage);

      const health = service.getProviderHealth();
      const twilioHealth = health.find(h => h.provider === 'twilio');
      expect(twilioHealth?.healthy).toBe(false);
      expect(twilioHealth?.error).toBe('Twilio error: Twilio error');
    });
  });

  describe('sendWithTwilio', () => {
    it('should throw error when Twilio client not initialized', async () => {
      const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'SMS_PROVIDER_PRIORITY') return 'twilio,nexmo';
          if (key === 'SMS_TWILIO_ACCOUNT_SID') return null;
          if (key === 'SMS_TWILIO_AUTH_TOKEN') return null;
          if (key === 'SMS_TWILIO_PHONE_NUMBER') return null;
          if (key === 'SMS_NEXMO_API_KEY') return null;
          if (key === 'SMS_NEXMO_API_SECRET') return null;
          if (key === 'SMS_NEXMO_PHONE_NUMBER') return null;
          if (key === 'SMS_RATE_LIMIT_PER_MINUTE') return 10;
          if (key === 'SMS_DELIVERY_TIMEOUT_MS') return 30000;
          return defaultValue;
        }),
      };

      const serviceWithoutTwilio = new SmsService(mockConfigService as any);

      const message: SMSMessage = {
        to: '+1234567890',
        body: 'Test',
      };

      await expect((serviceWithoutTwilio as any).sendWithTwilio(message)).rejects.toThrow(
        'Twilio client not initialized',
      );
    });

    it('should throw error when phone number not configured', async () => {
      const configWithoutPhone = {
        ...mockConfig,
        TWILIO_PHONE_NUMBER: null,
      };

      const serviceWithoutPhone = new SmsService({
        get: jest.fn((key: string) => configWithoutPhone[key]),
      } as any);

      const message: SMSMessage = {
        to: '+1234567890',
        body: 'Test',
      };

      await expect((serviceWithoutPhone as any).sendWithTwilio(message)).rejects.toThrow(
        'Twilio phone number not configured',
      );
    });

    it('should send SMS successfully via Twilio', async () => {
      const mockTwilioResponse = {
        sid: 'SM1234567890',
        status: 'queued',
        price: '0.0075',
      };

      mockTwilioClient.messages.create.mockResolvedValue(mockTwilioResponse);

      const message: SMSMessage = {
        to: '+1234567890',
        body: 'Test message',
        from: '+0987654321',
      };

      const result = await (service as any).sendWithTwilio(message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SM1234567890');
      expect(result.provider).toBe('twilio');
      expect(result.status).toBe('queued');
      expect(result.cost).toBe(0.0075);
    });
  });

  describe('sendWithVonage', () => {
    it('should throw error when Vonage client not initialized', async () => {
      const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'SMS_PROVIDER_PRIORITY') return 'twilio,nexmo';
          if (key === 'SMS_TWILIO_ACCOUNT_SID') return null;
          if (key === 'SMS_TWILIO_AUTH_TOKEN') return null;
          if (key === 'SMS_TWILIO_PHONE_NUMBER') return null;
          if (key === 'SMS_NEXMO_API_KEY') return null;
          if (key === 'SMS_NEXMO_API_SECRET') return null;
          if (key === 'SMS_NEXMO_PHONE_NUMBER') return null;
          if (key === 'SMS_RATE_LIMIT_PER_MINUTE') return 10;
          if (key === 'SMS_DELIVERY_TIMEOUT_MS') return 30000;
          return defaultValue;
        }),
      };

      const serviceWithoutVonage = new SmsService(mockConfigService as any);

      const message: SMSMessage = {
        to: '+1234567890',
        body: 'Test',
      };

      await expect((serviceWithoutVonage as any).sendWithVonage(message)).rejects.toThrow(
        'Vonage client not initialized',
      );
    });

    it('should send SMS successfully via Vonage', async () => {
      const mockVonageResponse = {
        messages: [
          {
            status: '0',
            'message-id': 'VM1234567890',
          },
        ],
      };

      mockVonageClient.sms.send.mockResolvedValue(mockVonageResponse);

      const message: SMSMessage = {
        to: '+1234567890',
        body: 'Test message',
      };

      const result = await (service as any).sendWithVonage(message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('VM1234567890');
      expect(result.provider).toBe('vonage');
      expect(result.status).toBe('sent');
    });

    it('should handle Vonage delivery failure', async () => {
      const mockVonageResponse = {
        messages: [
          {
            status: '1',
            'error-text': 'Invalid number',
            'message-id': 'VM1234567890',
          },
        ],
      };

      mockVonageClient.sms.send.mockResolvedValue(mockVonageResponse);

      const message: SMSMessage = {
        to: '+1234567890',
        body: 'Test message',
      };

      const result = await (service as any).sendWithVonage(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid number');
      expect(result.status).toBe('failed');
    });
  });

  describe('getDeliveryStatus', () => {
    it('should get Twilio message status', async () => {
      const mockMessage = {
        sid: 'SM1234567890',
        status: 'delivered',
        to: '+1234567890',
        from: '+0987654321',
        dateSent: new Date(),
        dateCreated: new Date(),
        price: '0.0075',
      };

      // Mock the messages property to return an object with fetch method
      Object.defineProperty(mockTwilioClient, 'messages', {
        value: jest.fn(() => ({
          fetch: jest.fn().mockResolvedValue(mockMessage),
        })),
        configurable: true,
      });

      const result = await service.getDeliveryStatus('SM1234567890', 'twilio');

      expect(result.messageId).toBe('SM1234567890');
      expect(result.provider).toBe('twilio');
      expect(result.status).toBe('delivered');
    });

    it('should return unknown status for Nexmo', async () => {
      const result = await service.getDeliveryStatus('VM1234567890', 'nexmo');

      expect(result.messageId).toBe('VM1234567890');
      expect(result.provider).toBe('nexmo');
      expect(result.status).toBe('unknown');
      expect(result.note).toBe('Nexmo delivery status not available via API');
    });

    it('should throw error for unsupported provider', async () => {
      await expect(service.getDeliveryStatus('MSG123', 'unsupported' as any)).rejects.toThrow(
        'Provider not specified or not supported',
      );
    });
  });

  describe('testSMS', () => {
    it('should send test SMS with default message', async () => {
      const mockTwilioResponse = {
        sid: 'SM1234567890',
        status: 'sent',
        price: '0.0075',
      };

      mockTwilioClient.messages.create.mockResolvedValue(mockTwilioResponse);

      const result = await service.testSMS('+1234567890');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SM1234567890');
      expect(mockTwilioClient.messages.create).toHaveBeenCalled();
      const callArgs = mockTwilioClient.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain('Test SMS from MASH Device Monitoring System');
      expect(callArgs.to).toBe('+1234567890');
    });

    it('should send test SMS with custom message', async () => {
      const mockTwilioResponse = {
        sid: 'SM1234567890',
        status: 'sent',
        price: '0.0075',
      };

      mockTwilioClient.messages.create.mockResolvedValue(mockTwilioResponse);

      const customMessage = 'Custom test message';
      const result = await service.testSMS('+1234567890', customMessage);

      expect(result.success).toBe(true);
      expect(mockTwilioClient.messages.create).toHaveBeenCalled();
      const callArgs = mockTwilioClient.messages.create.mock.calls[0][0];
      expect(callArgs.body).toBe(customMessage);
    });
  });

  describe('Utility methods', () => {
    it('should check if SMS service is available', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('should return rate limit', () => {
      expect(service.getRateLimit()).toBe(10);
    });

    it('should return delivery timeout', () => {
      expect(service.getDeliveryTimeout()).toBe(30000);
    });

    it('should return provider health status', () => {
      const health = service.getProviderHealth();
      expect(health).toHaveLength(2);
      expect(health[0]).toHaveProperty('provider');
      expect(health[0]).toHaveProperty('healthy');
      expect(health[0]).toHaveProperty('lastChecked');
    });
  });
});
