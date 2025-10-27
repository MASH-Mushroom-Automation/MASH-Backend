import { Injectable } from '@nestjs/common';

export interface SMSTemplateVariables {
  [key: string]: string | number | boolean;
}

export enum SMSTemplateType {
  DEVICE_OFFLINE = 'device-offline',
  DEVICE_ERROR = 'device-error',
  HEALTH_WARNING = 'health-warning',
  HEALTH_CRITICAL = 'health-critical',
  TEST_MESSAGE = 'test-message',
}

export interface SMSTemplate {
  type: SMSTemplateType;
  template: string;
  maxLength: number;
  variables: Record<
    string,
    {
      type: 'string' | 'number' | 'boolean';
      description: string;
      required: boolean;
      default?: any;
    }
  >;
}

@Injectable()
export class SMSTemplateService {
  private readonly templates: Map<SMSTemplateType, SMSTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Initialize SMS templates
   */
  private initializeTemplates(): void {
    // Device offline template
    this.templates.set(SMSTemplateType.DEVICE_OFFLINE, {
      type: SMSTemplateType.DEVICE_OFFLINE,
      template:
        'ALERT: Device {{deviceId}} is offline. Last seen: {{lastSeen}}',
      maxLength: 160,
      variables: {
        deviceId: {
          type: 'string',
          description: 'Device identifier',
          required: true,
        },
        lastSeen: {
          type: 'string',
          description: 'Last seen timestamp',
          required: false,
          default: 'Unknown',
        },
      },
    });

    // Device error template
    this.templates.set(SMSTemplateType.DEVICE_ERROR, {
      type: SMSTemplateType.DEVICE_ERROR,
      template: 'ERROR: Device {{deviceId}} reported error: {{errorMessage}}',
      maxLength: 160,
      variables: {
        deviceId: {
          type: 'string',
          description: 'Device identifier',
          required: true,
        },
        errorMessage: {
          type: 'string',
          description: 'Error message',
          required: true,
        },
      },
    });

    // Health warning template
    this.templates.set(SMSTemplateType.HEALTH_WARNING, {
      type: SMSTemplateType.HEALTH_WARNING,
      template:
        'WARNING: Device {{deviceId}} health issue - {{metric}}: {{value}}%',
      maxLength: 160,
      variables: {
        deviceId: {
          type: 'string',
          description: 'Device identifier',
          required: true,
        },
        metric: {
          type: 'string',
          description: 'Health metric (CPU, Memory, etc.)',
          required: true,
        },
        value: {
          type: 'number',
          description: 'Metric value',
          required: true,
        },
      },
    });

    // Health critical template
    this.templates.set(SMSTemplateType.HEALTH_CRITICAL, {
      type: SMSTemplateType.HEALTH_CRITICAL,
      template:
        'CRITICAL: Device {{deviceId}} - {{metric}}: {{value}}%. Immediate attention required!',
      maxLength: 160,
      variables: {
        deviceId: {
          type: 'string',
          description: 'Device identifier',
          required: true,
        },
        metric: {
          type: 'string',
          description: 'Health metric (CPU, Memory, etc.)',
          required: true,
        },
        value: {
          type: 'number',
          description: 'Metric value',
          required: true,
        },
      },
    });

    // Test message template
    this.templates.set(SMSTemplateType.TEST_MESSAGE, {
      type: SMSTemplateType.TEST_MESSAGE,
      template:
        'Test SMS from MASH Device Monitoring System. Time: {{timestamp}}',
      maxLength: 160,
      variables: {
        timestamp: {
          type: 'string',
          description: 'Current timestamp',
          required: false,
          default: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Render SMS template with variables
   */
  renderTemplate(
    type: SMSTemplateType,
    variables: SMSTemplateVariables = {},
  ): string {
    const template = this.templates.get(type);
    if (!template) {
      throw new Error(`SMS template '${type}' not found`);
    }

    // Validate required variables and set defaults
    for (const [key, config] of Object.entries(template.variables)) {
      if (!(key in variables)) {
        if (config.default !== undefined) {
          variables[key] = config.default;
        } else if (config.required) {
          throw new Error(
            `Required variable '${key}' missing for SMS template '${type}'`,
          );
        }
      }
    }

    // Render template
    let message = template.template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      message = message.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Ensure message doesn't exceed max length
    if (message.length > template.maxLength) {
      message = message.substring(0, template.maxLength - 3) + '...';
    }

    return message;
  }

  /**
   * Get all available SMS templates
   */
  getAllTemplates(): SMSTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by type
   */
  getTemplate(type: SMSTemplateType): SMSTemplate | undefined {
    return this.templates.get(type);
  }

  /**
   * Validate template variables
   */
  validateVariables(
    type: SMSTemplateType,
    variables: SMSTemplateVariables,
  ): { valid: boolean; errors: string[] } {
    const template = this.templates.get(type);
    if (!template) {
      return { valid: false, errors: [`Template '${type}' not found`] };
    }

    const errors: string[] = [];

    for (const [key, config] of Object.entries(template.variables)) {
      const value = variables[key];

      if (config.required && (value === undefined || value === null)) {
        if (config.default === undefined) {
          errors.push(`Required variable '${key}' is missing`);
        }
      }

      // Type validation
      if (value !== undefined && value !== null) {
        const actualType = typeof value;
        if (actualType !== config.type) {
          errors.push(
            `Variable '${key}' should be of type '${config.type}' but got '${actualType}'`,
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get template preview with sample data
   */
  getTemplatePreview(type: SMSTemplateType): string {
    const template = this.templates.get(type);
    if (!template) {
      throw new Error(`SMS template '${type}' not found`);
    }

    // Generate sample variables
    const sampleVars: SMSTemplateVariables = {};
    for (const [key, config] of Object.entries(template.variables)) {
      switch (config.type) {
        case 'string':
          sampleVars[key] = `sample_${key}`;
          break;
        case 'number':
          sampleVars[key] = 85;
          break;
        case 'boolean':
          sampleVars[key] = true;
          break;
      }
    }

    return this.renderTemplate(type, sampleVars);
  }
}
