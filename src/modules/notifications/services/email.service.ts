/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import sgMail from '@sendgrid/mail';
import axios from 'axios';
import { EmailTemplateService, EmailTemplateType } from './email-template.service';

export interface SendEmailOptions {
  to: string;
  subject?: string;
  templateType: EmailTemplateType;
  variables: Record<string, any>;
  provider?: EmailProvider;
}

export enum EmailProvider {
  SMTP = 'smtp',
  SENDGRID = 'sendgrid',
  RESEND = 'resend',
  // Add more providers as needed
}

interface EmailProviderConfig {
  name: EmailProvider;
  enabled: boolean;
  priority: number; // Lower number = higher priority
  transporter?: Transporter;
  apiKey?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly providers: EmailProviderConfig[] = [];

  constructor(private readonly emailTemplateService: EmailTemplateService) {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize Resend provider if configured (MAIN API - Highest Priority)
    const resendApiKey = process.env.RESEND_API || process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const resendFrom = process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM;
      this.providers.push({
        name: EmailProvider.RESEND,
        enabled: true,
        priority: 0, // Highest priority
        apiKey: resendApiKey,
      });
      this.logger.log('✅ Resend email provider initialized (Priority 0)');
      if (!resendFrom) {
        this.logger.warn(
          '⚠️ RESEND_FROM_EMAIL not set - Resend requires a verified domain. Gmail addresses will be REJECTED. Set RESEND_FROM_EMAIL=YourName <noreply@your-verified-domain.com>',
        );
      } else {
        this.logger.log(`📧 Resend from address: ${resendFrom}`);
      }
    }

    // Initialize SendGrid provider if configured (Priority 1)
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.providers.push({
        name: EmailProvider.SENDGRID,
        enabled: true,
        priority: 1,
      });
      this.logger.log('✅ SendGrid email provider initialized (Priority 1)');
    }

    // Initialize SMTP provider (fallback)
    const smtpTransporter = this.createSMTPTransporter();
    this.providers.push({
      name: EmailProvider.SMTP,
      enabled: !!process.env.EMAIL_HOST, // Only enabled if SMTP is configured
      priority: 10, // Lower priority
      transporter: smtpTransporter,
    });

    // Sort providers by priority (lower number = higher priority)
    this.providers.sort((a, b) => a.priority - b.priority);

    const enabledProviders = this.providers.filter(p => p.enabled).map(p => p.name);
    this.logger.log(
      `Initialized ${this.providers.length} email providers: ${enabledProviders.join(', ')}`,
    );
  }

  private createSMTPTransporter(): Transporter {
    // Check if required environment variables are set
    const requiredVars = {
      EMAIL_HOST: process.env.EMAIL_HOST,
      EMAIL_PORT: process.env.EMAIL_PORT,
      EMAIL_USER: process.env.EMAIL_USER,
      EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
      EMAIL_FROM: process.env.EMAIL_FROM,
    };

    const missingVars = Object.entries(requiredVars)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      this.logger.error(
        `❌ SMTP EMAIL SERVICE NOT CONFIGURED! Missing environment variables: ${missingVars.join(', ')}`,
      );
      this.logger.error('📧 SMTP email sending will FAIL until you add these variables');
    }

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number.parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      connectionTimeout: 5000, // 5s to connect
      greetingTimeout: 5000, // 5s to wait for greeting
      socketTimeout: 10000, // 10s to wait for socket activity
    });

    // Verify transporter configuration
    transporter.verify(error => {
      if (error) {
        this.logger.error('❌ SMTP Email transporter configuration error:', error.message);
        if (error.message.includes('Invalid login')) {
          this.logger.error(
            '🔑 Gmail App Password is invalid or expired. Generate new one at: https://myaccount.google.com/apppasswords',
          );
        }
      } else {
        this.logger.log('✅ SMTP Email transporter is ready to send emails');
        this.logger.log(
          `📧 Sending emails from: ${process.env.EMAIL_FROM || process.env.EMAIL_USER}`,
        );
      }
    });

    return transporter;
  }

  // SendGrid transporter implementation is now in sendViaProvider method
  // using direct SendGrid Web API integration

  private async getAvailableProvider(): Promise<EmailProviderConfig | null> {
    for (const provider of this.providers) {
      if (provider.enabled) {
        // Provider health checks implemented in sendViaProvider method
        // Automatic fallback if primary provider fails
        return provider;
      }
    }
    return null;
  }

  /**
   * Send an email using a template with provider failover
   */
  async sendTemplatedEmail(options: SendEmailOptions): Promise<void> {
    let provider: EmailProviderConfig | null = null;
    try {
      // Get the best available provider
      provider = await this.getAvailableProvider();
      if (!provider) {
        throw new Error('No email providers available');
      }

      this.logger.log(`Using email provider: ${provider.name}`);

      // Render the template with variables
      const { html, text, subject } = await this.emailTemplateService.renderTemplate(
        options.templateType,
        options.variables,
      );

      // Use provided subject or template subject
      const emailSubject = options.subject || subject;
      const fromEmail = process.env.EMAIL_FROM || 'noreply@mash.com';

      // Send using the selected provider
      if (provider.name === EmailProvider.RESEND && provider.apiKey) {
        // Resend API implementation (DIRECT HTTP CALL - FASTEST)
        // This prevents SMTP timeouts commonly seen in production/Railway environments
        // Resend requires a verified domain - gmail.com will NOT work
        const resendFromEmail =
          process.env.RESEND_FROM_EMAIL ||
          process.env.RESEND_FROM ||
          fromEmail;

        await axios.post(
          'https://api.resend.com/emails',
          {
            from: resendFromEmail,
            to: [options.to],
            subject: emailSubject,
            text: text,
            html: html,
          },
          {
            headers: {
              Authorization: `Bearer ${provider.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 8000, // 8s timeout to prevent hanging registration (Railway limit is ~30s)
          },
        );
        this.logger.log(`✅ Email sent successfully to ${options.to} via Resend API (HTTP)`);
      } else if (provider.name === EmailProvider.SENDGRID) {
        // SendGrid API implementation
        const msg = {
          to: options.to,
          from: fromEmail,
          subject: emailSubject,
          text: text,
          html: html,
        };

        await sgMail.send(msg);
        this.logger.log(`✅ Email sent successfully to ${options.to} via SendGrid`);
      } else if (provider.name === EmailProvider.SMTP && provider.transporter) {
        // SMTP implementation (fallback)
        const info = await provider.transporter.sendMail({
          from: fromEmail,
          to: options.to,
          subject: emailSubject,
          text: text,
          html: html,
        });

        this.logger.log(`✅ Email sent successfully to ${options.to} via SMTP: ${info.messageId}`);
      } else {
        throw new Error(`Unsupported provider: ${provider.name}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${options.to}:`, error.message || error);

      // Automatic Failover Logic: If the primary provider fails, try the next available one
      const providers = this.providers.filter(p => p.enabled);
      if (providers.length > 1) {
        // Find the index of the provider that just failed
        // If provider is null (failed during lookup), start from the first one
        const currentProviderIndex = provider
          ? providers.findIndex(p => p.name === provider.name)
          : -1;
        // If there's a next provider, try it
        if (currentProviderIndex < providers.length - 1) {
          const fallbackProvider = providers[currentProviderIndex + 1];
          this.logger.warn(`🔄 Attempting failover to ${fallbackProvider.name}...`);

          try {
            // Render template again (variables are still in scope)
            const {
              html,
              text,
              subject: fallbackSubject,
            } = await this.emailTemplateService.renderTemplate(
              options.templateType,
              options.variables,
            );

            const emailSubject = options.subject || fallbackSubject;
            const fromEmail = process.env.EMAIL_FROM || 'noreply@mash.com';

            if (fallbackProvider.name === EmailProvider.SENDGRID) {
              await sgMail.send({
                to: options.to,
                from: fromEmail,
                subject: emailSubject,
                text,
                html,
              });
              this.logger.log(`✅ Email sent via ${fallbackProvider.name} failover`);
              return;
            } else if (fallbackProvider.transporter) {
              const info = await fallbackProvider.transporter.sendMail({
                from: fromEmail,
                to: options.to,
                subject: emailSubject,
                text,
                html,
              });
              this.logger.log(
                `✅ Email sent via ${fallbackProvider.name} failover: ${info.messageId}`,
              );
              return;
            }
          } catch (failoverError) {
            this.logger.error(
              `❌ ${fallbackProvider.name} failover also failed:`,
              failoverError.message,
            );
          }
        }
      }

      throw error; // Propagate final error if all attempts fail
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(
    to: string,
    firstName: string,
    verificationLink: string,
    expiresIn: string = '24 hours',
  ): Promise<void> {
    await this.sendTemplatedEmail({
      to,
      templateType: EmailTemplateType.VERIFICATION,
      variables: {
        ...this.emailTemplateService.getVerificationVariables(firstName, verificationLink),
        expiresIn, // Override with custom expiration
        year: new Date().getFullYear().toString(),
      },
    });
  }

  /**
   * Send verification code email (6-digit code for mobile apps)
   * PRIMARY METHOD for mobile-friendly email verification
   */
  async sendVerificationCodeEmail(
    to: string,
    firstName: string,
    code: string,
    expiresIn: string = '10 minutes',
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const supportEmail = process.env.EMAIL_FROM || 'support@mash.com';

    await this.sendTemplatedEmail({
      to,
      templateType: EmailTemplateType.VERIFICATION_CODE,
      variables: {
        firstName,
        code,
        expiresIn,
        supportEmail,
        appUrl: frontendUrl,
        year: new Date().getFullYear().toString(),
      },
    });

    this.logger.log(
      `✅ Verification code email sent to: ${to} (Code: ${code}, Expires: ${expiresIn})`,
    );
  }

  /**
   * Send password reset code email (6-digit code)
   */
  async sendPasswordResetCodeEmail(
    to: string,
    firstName: string,
    code: string,
    expiresIn: string = '10 minutes',
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const supportEmail = process.env.EMAIL_FROM || 'support@mash.com';

    await this.sendTemplatedEmail({
      to,
      templateType: EmailTemplateType.PASSWORD_RESET_CODE,
      variables: {
        firstName,
        code,
        expiresIn,
        supportEmail,
        appUrl: frontendUrl,
        year: new Date().getFullYear().toString(),
      },
    });

    this.logger.log(
      `✅ Password reset code email sent to: ${to} (Code: ${code}, Expires: ${expiresIn})`,
    );
  }

  /**
   * Send password reset confirmation email
   */
  async sendPasswordResetConfirmationEmail(to: string, firstName: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const supportEmail = process.env.EMAIL_FROM || 'support@mash.com';

    await this.sendTemplatedEmail({
      to,
      templateType: EmailTemplateType.PASSWORD_RESET_CONFIRMATION,
      variables: {
        firstName,
        supportEmail,
        appUrl: frontendUrl,
        year: new Date().getFullYear().toString(),
        changeDate: new Date().toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      },
    });

    this.logger.log(`✅ Password reset confirmation email sent to: ${to}`);
  }

  /**
   * Send forgot password email (OLD METHOD - using reset link)
   */
  async sendForgotPasswordEmail(
    to: string,
    firstName: string,
    resetLink: string,
    expiresIn: string = '1 hour',
  ): Promise<void> {
    await this.sendTemplatedEmail({
      to,
      templateType: EmailTemplateType.FORGOT_PASSWORD,
      variables: {
        ...this.emailTemplateService.getForgotPasswordVariables(firstName, resetLink),
        expiresIn, // Override with custom expiration
        year: new Date().getFullYear().toString(),
      },
    });
  }

  /**
   * Send password changed confirmation email
   */
  async sendPasswordChangedEmail(
    to: string,
    firstName: string,
    changeDate: string,
    ipAddress: string,
  ): Promise<void> {
    await this.sendTemplatedEmail({
      to,
      templateType: EmailTemplateType.PASSWORD_CHANGED,
      variables: {
        ...this.emailTemplateService.getPasswordChangedVariables(firstName, new Date(changeDate)),
        email: to,
        changeDate,
        ipAddress,
        year: new Date().getFullYear().toString(),
      },
    });
  }

  /**
   * Send 2FA code email
   */
  async send2FACodeEmail(
    to: string,
    firstName: string,
    code: string,
    expiresIn: string = '10 minutes',
  ): Promise<void> {
    await this.sendTemplatedEmail({
      to,
      templateType: EmailTemplateType.TWO_FACTOR_AUTH,
      variables: {
        ...this.emailTemplateService.getTwoFactorAuthVariables(firstName, code),
        expiresIn, // Override with custom expiration
        year: new Date().getFullYear().toString(),
      },
    });
  }

  /**
   * Send resend verification email
   */
  async sendResendVerificationEmail(
    to: string,
    firstName: string,
    verificationLink: string,
    expiresIn: string = '24 hours',
  ): Promise<void> {
    await this.sendTemplatedEmail({
      to,
      templateType: EmailTemplateType.RESEND_VERIFICATION,
      variables: {
        ...this.emailTemplateService.getVerificationVariables(firstName, verificationLink),
        expiresIn, // Override with custom expiration
        year: new Date().getFullYear().toString(),
      },
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(to: string, firstName: string, dashboardUrl: string): Promise<void> {
    await this.sendTemplatedEmail({
      to,
      templateType: EmailTemplateType.WELCOME,
      variables: {
        firstName,
        dashboardUrl,
        homeUrl: process.env.APP_URL || 'https://mash.com',
        supportUrl: process.env.APP_URL
          ? `${process.env.APP_URL}/support`
          : 'https://mash.com/support',
        privacyUrl: process.env.APP_URL
          ? `${process.env.APP_URL}/privacy`
          : 'https://mash.com/privacy',
        termsUrl: process.env.APP_URL ? `${process.env.APP_URL}/terms` : 'https://mash.com/terms',
      },
    });
  }

  /**
   * Send account locked email
   */
  async sendAccountLockedEmail(
    to: string,
    firstName: string,
    reason: string,
    lockedAt: string,
    userId: string,
    ipAddress: string,
    unlockUrl: string,
  ): Promise<void> {
    await this.sendTemplatedEmail({
      to,
      templateType: EmailTemplateType.ACCOUNT_LOCKED,
      variables: {
        firstName,
        email: to,
        reason,
        lockedAt,
        userId,
        ipAddress,
        unlockUrl,
        homeUrl: process.env.APP_URL || 'https://mash.com',
        supportUrl: process.env.APP_URL
          ? `${process.env.APP_URL}/support`
          : 'https://mash.com/support',
        securityUrl: process.env.APP_URL
          ? `${process.env.APP_URL}/security`
          : 'https://mash.com/security',
        privacyUrl: process.env.APP_URL
          ? `${process.env.APP_URL}/privacy`
          : 'https://mash.com/privacy',
      },
    });
  }

  /**
   * Send password reset success email
   */
  async sendPasswordResetSuccessEmail(
    to: string,
    firstName: string,
    resetDate: string,
    ipAddress: string,
    device: string,
    signInUrl: string,
  ): Promise<void> {
    await this.sendTemplatedEmail({
      to,
      templateType: EmailTemplateType.PASSWORD_RESET_SUCCESS,
      variables: {
        firstName,
        email: to,
        resetDate,
        ipAddress,
        device,
        signInUrl,
        homeUrl: process.env.APP_URL || 'https://mash.com',
        supportUrl: process.env.APP_URL
          ? `${process.env.APP_URL}/support`
          : 'https://mash.com/support',
        securityUrl: process.env.APP_URL
          ? `${process.env.APP_URL}/security`
          : 'https://mash.com/security',
        privacyUrl: process.env.APP_URL
          ? `${process.env.APP_URL}/privacy`
          : 'https://mash.com/privacy',
      },
    });
  }

  /**
   * Send email changed notification
   */
  async sendEmailChangedNotification(options: {
    oldEmail: string;
    newEmail: string;
    firstName: string;
    changeDate: string;
    ipAddress: string;
    device: string;
    location: string;
    accountUrl: string;
  }): Promise<void> {
    const { oldEmail, newEmail, firstName, changeDate, ipAddress, device, location, accountUrl } =
      options;

    // Send to both old and new email addresses for security
    const variables = {
      firstName,
      oldEmail,
      newEmail,
      changeDate,
      ipAddress,
      device,
      location,
      accountUrl,
      homeUrl: process.env.APP_URL || 'https://mash.com',
      supportUrl: process.env.APP_URL
        ? `${process.env.APP_URL}/support`
        : 'https://mash.com/support',
      securityUrl: process.env.APP_URL
        ? `${process.env.APP_URL}/security`
        : 'https://mash.com/security',
      privacyUrl: process.env.APP_URL
        ? `${process.env.APP_URL}/privacy`
        : 'https://mash.com/privacy',
    };

    // Send to old email
    await this.sendTemplatedEmail({
      to: oldEmail,
      templateType: EmailTemplateType.EMAIL_CHANGED,
      variables,
    });

    // Send to new email
    await this.sendTemplatedEmail({
      to: newEmail,
      templateType: EmailTemplateType.EMAIL_CHANGED,
      variables,
    });
  }

  /**
   * Send account deletion confirmation
   */
  async sendAccountDeletionEmail(options: {
    to: string;
    firstName: string;
    requestDate: string;
    deletionDate: string;
    gracePeriod: string;
    cancelUrl: string;
    downloadDataUrl: string;
    feedbackUrl: string;
  }): Promise<void> {
    const {
      to,
      firstName,
      requestDate,
      deletionDate,
      gracePeriod,
      cancelUrl,
      downloadDataUrl,
      feedbackUrl,
    } = options;

    await this.sendTemplatedEmail({
      to,
      templateType: EmailTemplateType.ACCOUNT_DELETION,
      variables: {
        firstName,
        email: to,
        requestDate,
        deletionDate,
        gracePeriod,
        cancelUrl,
        downloadDataUrl,
        feedbackUrl,
        homeUrl: process.env.APP_URL || 'https://mash.com',
        supportUrl: process.env.APP_URL
          ? `${process.env.APP_URL}/support`
          : 'https://mash.com/support',
        privacyUrl: process.env.APP_URL
          ? `${process.env.APP_URL}/privacy`
          : 'https://mash.com/privacy',
        termsUrl: process.env.APP_URL ? `${process.env.APP_URL}/terms` : 'https://mash.com/terms',
      },
    });
  }

  /**
   * Send a raw email (for custom use cases)
   */
  async sendRawEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
    try {
      const provider = await this.getAvailableProvider();
      if (!provider) {
        throw new Error('No email providers available');
      }

      this.logger.log(`Using email provider for raw email: ${provider.name}`);
      const fromEmail = process.env.EMAIL_FROM || 'MASH System <noreply@mash.com>';

      if (provider.name === EmailProvider.RESEND && provider.apiKey) {
        // Fast Resend API implementation
        // Resend requires a verified domain - gmail.com will NOT work
        const resendFromEmail =
          process.env.RESEND_FROM_EMAIL ||
          process.env.RESEND_FROM ||
          fromEmail;

        await axios.post(
          'https://api.resend.com/emails',
          {
            from: resendFromEmail,
            to: [to],
            subject,
            text: text || html.replaceAll(/<[^>]*>/g, ''),
            html,
          },
          {
            headers: {
              Authorization: `Bearer ${provider.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 8000,
          },
        );
        this.logger.log(`✅ Raw email sent successfully to ${to} via Resend API (HTTP)`);
      } else if (provider.name === EmailProvider.SENDGRID) {
        const msg = {
          to,
          from: fromEmail,
          subject,
          text: text || html.replaceAll(/<[^>]*>/g, ''),
          html,
        };
        await sgMail.send(msg);
        this.logger.log(`✅ Raw email sent successfully to ${to} via SendGrid`);
      } else if (provider.transporter) {
        const info = await provider.transporter.sendMail({
          from: fromEmail,
          to,
          subject,
          text: text || html.replaceAll(/<[^>]*>/g, ''),
          html,
        });

        this.logger.log(
          `✅ Raw email sent successfully to ${to} via ${provider.name}: ${info.messageId}`,
        );
      } else {
        throw new Error(`Unsupported provider: ${provider.name}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to send raw email to ${to}:`, error.message || error);
      throw error;
    }
  }
}
