import { Test, TestingModule } from '@nestjs/testing';
import {
  SMSTemplateService,
  SMSTemplateType,
  SMSTemplateVariables,
} from './services/sms-template.service';

describe('SMSTemplateService', () => {
  let service: SMSTemplateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SMSTemplateService],
    }).compile();

    service = module.get<SMSTemplateService>(SMSTemplateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Template Initialization', () => {
    it('should initialize all predefined templates', () => {
      const templates = service.getAllTemplates();
      expect(templates).toHaveLength(5);

      const templateTypes = templates.map(t => t.type);
      expect(templateTypes).toContain(SMSTemplateType.DEVICE_OFFLINE);
      expect(templateTypes).toContain(SMSTemplateType.DEVICE_ERROR);
      expect(templateTypes).toContain(SMSTemplateType.HEALTH_WARNING);
      expect(templateTypes).toContain(SMSTemplateType.HEALTH_CRITICAL);
      expect(templateTypes).toContain(SMSTemplateType.TEST_MESSAGE);
    });

    it('should get template by type', () => {
      const template = service.getTemplate(SMSTemplateType.DEVICE_OFFLINE);
      expect(template).toBeDefined();
      expect(template?.type).toBe(SMSTemplateType.DEVICE_OFFLINE);
      expect(template?.template).toContain('ALERT: Device {{deviceId}} is offline');
    });

    it('should return undefined for non-existent template', () => {
      const template = service.getTemplate('non-existent' as SMSTemplateType);
      expect(template).toBeUndefined();
    });
  });

  describe('renderTemplate', () => {
    it('should render device offline template with required variables', () => {
      const variables: SMSTemplateVariables = {
        deviceId: 'sensor-001',
        lastSeen: '2025-10-27T10:00:00Z',
      };

      const result = service.renderTemplate(SMSTemplateType.DEVICE_OFFLINE, variables);
      expect(result).toBe('ALERT: Device sensor-001 is offline. Last seen: 2025-10-27T10:00:00Z');
    });

    it('should render device offline template with default values', () => {
      const variables: SMSTemplateVariables = {
        deviceId: 'sensor-001',
      };

      const result = service.renderTemplate(SMSTemplateType.DEVICE_OFFLINE, variables);
      expect(result).toBe('ALERT: Device sensor-001 is offline. Last seen: Unknown');
    });

    it('should render device error template', () => {
      const variables: SMSTemplateVariables = {
        deviceId: 'sensor-002',
        errorMessage: 'Temperature sensor failure',
      };

      const result = service.renderTemplate(SMSTemplateType.DEVICE_ERROR, variables);
      expect(result).toBe('ERROR: Device sensor-002 reported error: Temperature sensor failure');
    });

    it('should render health warning template', () => {
      const variables: SMSTemplateVariables = {
        deviceId: 'sensor-003',
        metric: 'CPU',
        value: 85,
      };

      const result = service.renderTemplate(SMSTemplateType.HEALTH_WARNING, variables);
      expect(result).toBe('WARNING: Device sensor-003 health issue - CPU: 85%');
    });

    it('should render health critical template', () => {
      const variables: SMSTemplateVariables = {
        deviceId: 'sensor-004',
        metric: 'Memory',
        value: 95,
      };

      const result = service.renderTemplate(SMSTemplateType.HEALTH_CRITICAL, variables);
      expect(result).toBe(
        'CRITICAL: Device sensor-004 - Memory: 95%. Immediate attention required!',
      );
    });

    it('should render test message template with default timestamp', () => {
      const result = service.renderTemplate(SMSTemplateType.TEST_MESSAGE);
      expect(result).toContain('Test SMS from MASH Device Monitoring System. Time:');
    });

    it('should render test message template with custom timestamp', () => {
      const variables: SMSTemplateVariables = {
        timestamp: '2025-10-27T12:00:00Z',
      };

      const result = service.renderTemplate(SMSTemplateType.TEST_MESSAGE, variables);
      expect(result).toBe(
        'Test SMS from MASH Device Monitoring System. Time: 2025-10-27T12:00:00Z',
      );
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        service.renderTemplate('non-existent' as SMSTemplateType);
      }).toThrow("SMS template 'non-existent' not found");
    });

    it('should throw error for missing required variables', () => {
      expect(() => {
        service.renderTemplate(SMSTemplateType.DEVICE_ERROR, {});
      }).toThrow("Required variable 'deviceId' missing for SMS template 'device-error'");
    });

    it('should truncate message if it exceeds max length', () => {
      const longErrorMessage = 'A'.repeat(200);
      const variables: SMSTemplateVariables = {
        deviceId: 'sensor-001',
        errorMessage: longErrorMessage,
      };

      const result = service.renderTemplate(SMSTemplateType.DEVICE_ERROR, variables);
      expect(result.length).toBeLessThanOrEqual(160);
      expect(result).toMatch(/\.\.\.$/);
    });

    it('should handle multiple variable replacements', () => {
      const variables: SMSTemplateVariables = {
        deviceId: 'sensor-001',
        metric: 'CPU',
        value: 90,
      };

      const result = service.renderTemplate(SMSTemplateType.HEALTH_WARNING, variables);
      expect(result).toBe('WARNING: Device sensor-001 health issue - CPU: 90%');
    });

    it('should convert non-string variables to strings', () => {
      const variables: SMSTemplateVariables = {
        deviceId: 'sensor-001',
        metric: 'CPU',
        value: 85.5,
      };

      const result = service.renderTemplate(SMSTemplateType.HEALTH_WARNING, variables);
      expect(result).toBe('WARNING: Device sensor-001 health issue - CPU: 85.5%');
    });
  });

  describe('validateVariables', () => {
    it('should validate valid variables', () => {
      const variables: SMSTemplateVariables = {
        deviceId: 'sensor-001',
        errorMessage: 'Test error',
      };

      const result = service.validateVariables(SMSTemplateType.DEVICE_ERROR, variables);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required variables', () => {
      const variables: SMSTemplateVariables = {
        deviceId: 'sensor-001',
        // missing errorMessage
      };

      const result = service.validateVariables(SMSTemplateType.DEVICE_ERROR, variables);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Required variable 'errorMessage' is missing");
    });

    it('should detect type mismatches', () => {
      const variables: SMSTemplateVariables = {
        deviceId: 'sensor-001',
        metric: 'CPU',
        value: '85', // should be number
      };

      const result = service.validateVariables(SMSTemplateType.HEALTH_WARNING, variables);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Variable 'value' should be of type 'number' but got 'string'",
      );
    });

    it('should accept valid types', () => {
      const variables: SMSTemplateVariables = {
        deviceId: 'sensor-001',
        metric: 'CPU',
        value: 85,
      };

      const result = service.validateVariables(SMSTemplateType.HEALTH_WARNING, variables);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle boolean variables', () => {
      // Create a custom template with boolean variable for testing
      const customTemplate = {
        type: 'custom' as SMSTemplateType,
        template: 'Status: {{enabled}}',
        maxLength: 160,
        variables: {
          enabled: {
            type: 'boolean' as const,
            description: 'Enabled status',
            required: true,
          },
        },
      };

      // Temporarily add custom template
      (service as any).templates.set('custom' as SMSTemplateType, customTemplate);

      const variables: SMSTemplateVariables = {
        enabled: true,
      };

      const result = service.validateVariables('custom' as SMSTemplateType, variables);
      expect(result.valid).toBe(true);

      // Clean up
      (service as any).templates.delete('custom' as SMSTemplateType);
    });

    it('should return error for non-existent template', () => {
      const result = service.validateVariables('non-existent' as SMSTemplateType, {});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Template 'non-existent' not found");
    });
  });

  describe('getTemplatePreview', () => {
    it('should generate preview for device offline template', () => {
      const preview = service.getTemplatePreview(SMSTemplateType.DEVICE_OFFLINE);
      expect(preview).toContain('ALERT: Device sample_deviceId is offline');
      expect(preview).toContain('sample_lastSeen');
    });

    it('should generate preview for device error template', () => {
      const preview = service.getTemplatePreview(SMSTemplateType.DEVICE_ERROR);
      expect(preview).toContain('ERROR: Device sample_deviceId reported error');
      expect(preview).toContain('sample_errorMessage');
    });

    it('should generate preview for health warning template', () => {
      const preview = service.getTemplatePreview(SMSTemplateType.HEALTH_WARNING);
      expect(preview).toContain('WARNING: Device sample_deviceId health issue');
      expect(preview).toContain('sample_metric');
      expect(preview).toContain('85%');
    });

    it('should generate preview for health critical template', () => {
      const preview = service.getTemplatePreview(SMSTemplateType.HEALTH_CRITICAL);
      expect(preview).toContain('CRITICAL: Device sample_deviceId');
      expect(preview).toContain('sample_metric');
      expect(preview).toContain('85%');
    });

    it('should generate preview for test message template', () => {
      const preview = service.getTemplatePreview(SMSTemplateType.TEST_MESSAGE);
      expect(preview).toContain('Test SMS from MASH Device Monitoring System');
      expect(preview).toContain('sample_timestamp');
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        service.getTemplatePreview('non-existent' as SMSTemplateType);
      }).toThrow("SMS template 'non-existent' not found");
    });
  });

  describe('Template Structure', () => {
    it('should have correct template structure for device offline', () => {
      const template = service.getTemplate(SMSTemplateType.DEVICE_OFFLINE);
      expect(template?.maxLength).toBe(160);
      expect(template?.variables.deviceId.required).toBe(true);
      expect(template?.variables.lastSeen.required).toBe(false);
      expect(template?.variables.lastSeen.default).toBe('Unknown');
    });

    it('should have correct template structure for device error', () => {
      const template = service.getTemplate(SMSTemplateType.DEVICE_ERROR);
      expect(template?.maxLength).toBe(160);
      expect(template?.variables.deviceId.required).toBe(true);
      expect(template?.variables.errorMessage.required).toBe(true);
    });

    it('should have correct template structure for health templates', () => {
      const warningTemplate = service.getTemplate(SMSTemplateType.HEALTH_WARNING);
      const criticalTemplate = service.getTemplate(SMSTemplateType.HEALTH_CRITICAL);

      [warningTemplate, criticalTemplate].forEach(template => {
        expect(template?.maxLength).toBe(160);
        expect(template?.variables.deviceId.required).toBe(true);
        expect(template?.variables.metric.required).toBe(true);
        expect(template?.variables.value.required).toBe(true);
        expect(template?.variables.value.type).toBe('number');
      });
    });

    it('should have correct template structure for test message', () => {
      const template = service.getTemplate(SMSTemplateType.TEST_MESSAGE);
      expect(template?.maxLength).toBe(160);
      expect(template?.variables.timestamp.required).toBe(false);
      expect(template?.variables.timestamp.type).toBe('string');
    });
  });
});
