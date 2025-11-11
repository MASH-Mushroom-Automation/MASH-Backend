import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

export interface EmailTemplateVariables {
  [key: string]: string | number | boolean | object;
}

export enum EmailTemplateType {
  VERIFICATION = 'verification',
  VERIFICATION_CODE = 'verification-code', // NEW: 6-digit code verification
  FORGOT_PASSWORD = 'forgot-password',
  PASSWORD_CHANGED = 'password-changed',
  RESEND_VERIFICATION = 'resend-verification',
  ACCOUNT_LOCKED = 'account-locked',
  TWO_FACTOR_AUTH = '2fa-code',
  PASSWORD_RESET_SUCCESS = 'password-reset-success',
  EMAIL_CHANGED = 'email-changed',
  ACCOUNT_DELETION = 'account-deletion',
  WELCOME = 'welcome',
  // Add more template types for device monitoring
  DEVICE_OFFLINE = 'device-offline',
  DEVICE_ERROR = 'device-error',
  HEALTH_WARNING = 'health-warning',
  HEALTH_CRITICAL = 'health-critical',
}

export interface TemplateMetadata {
  name: string;
  description?: string;
  variables: Record<
    string,
    {
      type: 'string' | 'number' | 'boolean' | 'object';
      description: string;
      required: boolean;
      default?: any;
    }
  >;
  conditionals?: string[]; // List of conditional variables
}

@Injectable()
export class EmailTemplateService {
  private readonly templatesPath = path.join(__dirname, '..', 'templates', 'email');

  /**
   * Render an email template with variables
   */
  async renderTemplate(
    templateType: EmailTemplateType,
    variables: EmailTemplateVariables,
  ): Promise<{ html: string; text: string; subject: string }> {
    try {
      // Read the template file
      const templatePath = path.join(this.templatesPath, `${templateType}.html`);
      let htmlTemplate = await readFile(templatePath, 'utf-8');

      // Replace variables in template
      htmlTemplate = this.replaceVariables(htmlTemplate, variables);

      // Generate plain text version
      const textTemplate = this.htmlToText(htmlTemplate);

      // Get subject from template or use default
      const subject = this.getSubject(templateType, variables);

      return {
        html: htmlTemplate,
        text: textTemplate,
        subject,
      };
    } catch (error) {
      throw new Error(`Failed to render email template ${templateType}: ${error.message}`);
    }
  }

  /**
   * Replace variables in template with advanced features
   */
  private replaceVariables(template: string, variables: EmailTemplateVariables): string {
    let result = template;

    // Replace all {{variable}} with actual values
    Object.keys(variables).forEach(key => {
      const value = variables[key];
      const regex = new RegExp(`{{${key}}}`, 'g');

      // Handle different value types
      let stringValue: string;
      if (typeof value === 'object' && value !== null) {
        stringValue = JSON.stringify(value);
      } else {
        stringValue = String(value);
      }

      result = result.replace(regex, stringValue);
    });

    // Handle conditional blocks {{#if condition}}content{{/if}}
    result = this.processConditionals(result, variables);

    // Add current year for copyright
    result = result.replace(/{{year}}/g, new Date().getFullYear().toString());

    // Add app URL if not provided
    if (!variables.appUrl) {
      result = result.replace(
        /{{appUrl}}/g,
        process.env.APP_URL || 'https://mash-backend-api.up.railway.app',
      );
    }

    // Add company name if not provided
    if (!variables.companyName) {
      result = result.replace(/{{companyName}}/g, 'MASH');
    }

    return result;
  }

  /**
   * Process conditional blocks in template
   */
  private processConditionals(template: string, variables: EmailTemplateVariables): string {
    let result = template;

    // Simple conditional processing: {{#if variable}}content{{/if}}
    const conditionalRegex = /{{#if\s+(\w+)}}(.*?){{\/if}}/gs;

    result = result.replace(conditionalRegex, (match, variable, content) => {
      const value = variables[variable];
      // Show content if variable is truthy
      return value ? content : '';
    });

    // Negated conditional: {{#unless variable}}content{{/unless}}
    const unlessRegex = /{{#unless\s+(\w+)}}(.*?){{\/unless}}/gs;

    result = result.replace(unlessRegex, (match, variable, content) => {
      const value = variables[variable];
      // Show content if variable is falsy
      return !value ? content : '';
    });

    return result;
  }

  /**
   * Convert HTML to plain text (basic implementation)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get email subject based on template type
   */
  private getSubject(templateType: EmailTemplateType, variables: EmailTemplateVariables): string {
    const subjects: Record<EmailTemplateType, string> = {
      [EmailTemplateType.VERIFICATION]: 'Verify Your Email - Welcome to MASH! 🍄',
      [EmailTemplateType.VERIFICATION_CODE]: 'Verify Your Email - MASH 🍄', // NEW: 6-digit code subject
      [EmailTemplateType.FORGOT_PASSWORD]: 'Reset Your Password - MASH',
      [EmailTemplateType.PASSWORD_CHANGED]: 'Your Password Has Been Changed - MASH',
      [EmailTemplateType.RESEND_VERIFICATION]: 'Verify Your Email - Action Required',
      [EmailTemplateType.ACCOUNT_LOCKED]: 'Account Security Alert - MASH',
      [EmailTemplateType.TWO_FACTOR_AUTH]: 'Your Two-Factor Authentication Code - MASH',
      [EmailTemplateType.PASSWORD_RESET_SUCCESS]: 'Password Reset Successful - MASH',
      [EmailTemplateType.EMAIL_CHANGED]: 'Email Address Changed - MASH',
      [EmailTemplateType.ACCOUNT_DELETION]: 'Account Deletion Confirmation - MASH',
      [EmailTemplateType.WELCOME]: 'Welcome to MASH! 🍄',
      [EmailTemplateType.DEVICE_OFFLINE]: 'Device Offline Alert - MASH',
      [EmailTemplateType.DEVICE_ERROR]: 'Device Error Alert - MASH',
      [EmailTemplateType.HEALTH_WARNING]: 'Device Health Warning - MASH',
      [EmailTemplateType.HEALTH_CRITICAL]: 'Critical Device Health Alert - MASH',
    };

    return subjects[templateType] || 'MASH Notification';
  }

  /**
   * Get template variables for verification email
   */
  getVerificationVariables(firstName: string, verificationLink: string): EmailTemplateVariables {
    return {
      firstName,
      verificationLink,
      expiresIn: '24 hours',
    };
  }

  /**
   * Get template variables for forgot password email
   */
  getForgotPasswordVariables(firstName: string, resetLink: string): EmailTemplateVariables {
    return {
      firstName,
      resetLink,
      expiresIn: '1 hour',
    };
  }

  /**
   * Get template variables for password changed email
   */
  getPasswordChangedVariables(firstName: string, changeDate: Date): EmailTemplateVariables {
    return {
      firstName,
      changeDate: changeDate.toLocaleString(),
      supportEmail: process.env.SUPPORT_EMAIL || 'support@mash.com',
    };
  }

  /**
   * Get template variables for 2FA code email
   */
  getTwoFactorAuthVariables(firstName: string, code: string): EmailTemplateVariables {
    return {
      firstName,
      code,
      expiresIn: '10 minutes',
    };
  }
}
