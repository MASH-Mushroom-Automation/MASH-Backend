import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import {
  EmailTemplateService,
  EmailTemplateType,
} from './email-template.service';

export interface SendEmailOptions {
  to: string;
  subject?: string;
  templateType: EmailTemplateType;
  variables: Record<string, any>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private readonly emailTemplateService: EmailTemplateService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
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
        `❌ EMAIL SERVICE NOT CONFIGURED! Missing environment variables: ${missingVars.join(', ')}`,
      );
      this.logger.error(
        '📧 Email sending will FAIL until you add these variables to Railway dashboard',
      );
      // Still create transporter to prevent app crash, but it will fail on send
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Verify transporter configuration
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error(
          '❌ Email transporter configuration error:',
          error.message,
        );
        if (error.message.includes('Invalid login')) {
          this.logger.error(
            '🔑 Gmail App Password is invalid or expired. Generate new one at: https://myaccount.google.com/apppasswords',
          );
        }
      } else {
        this.logger.log(
          '✅ Email transporter is ready to send emails via Gmail SMTP',
        );
        this.logger.log(
          `📧 Sending emails from: ${process.env.EMAIL_FROM || process.env.EMAIL_USER}`,
        );
      }
    });
  }

  /**
   * Send an email using a template
   */
  async sendTemplatedEmail(options: SendEmailOptions): Promise<void> {
    try {
      // Render the template with variables
      const { html, text, subject } =
        await this.emailTemplateService.renderTemplate(
          options.templateType,
          options.variables,
        );

      // Use provided subject or template subject
      const emailSubject = options.subject || subject;

      // Send the email
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'MASH System <noreply@mash.com>',
        to: options.to,
        subject: emailSubject,
        text: text,
        html: html,
      });

      this.logger.log(
        `Email sent successfully to ${options.to}: ${info.messageId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}:`, error);
      throw error;
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
        ...this.emailTemplateService.getVerificationVariables(
          firstName,
          verificationLink,
        ),
        expiresIn, // Override with custom expiration
        year: new Date().getFullYear().toString(),
      },
    });
  }

  /**
   * Send forgot password email
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
        ...this.emailTemplateService.getForgotPasswordVariables(
          firstName,
          resetLink,
        ),
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
        ...this.emailTemplateService.getPasswordChangedVariables(
          firstName,
          new Date(changeDate),
        ),
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
        ...this.emailTemplateService.getVerificationVariables(
          firstName,
          verificationLink,
        ),
        expiresIn, // Override with custom expiration
        year: new Date().getFullYear().toString(),
      },
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(
    to: string,
    firstName: string,
    dashboardUrl: string,
  ): Promise<void> {
    await this.sendTemplatedEmail({
      to,
      templateType: EmailTemplateType.WELCOME,
      variables: {
        firstName,
        dashboardUrl,
        homeUrl: process.env.APP_URL || 'https://mash.com',
        supportUrl:
          `${process.env.APP_URL}/support` || 'https://mash.com/support',
        privacyUrl:
          `${process.env.APP_URL}/privacy` || 'https://mash.com/privacy',
        termsUrl: `${process.env.APP_URL}/terms` || 'https://mash.com/terms',
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
        supportUrl:
          `${process.env.APP_URL}/support` || 'https://mash.com/support',
        securityUrl:
          `${process.env.APP_URL}/security` || 'https://mash.com/security',
        privacyUrl:
          `${process.env.APP_URL}/privacy` || 'https://mash.com/privacy',
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
        supportUrl:
          `${process.env.APP_URL}/support` || 'https://mash.com/support',
        securityUrl:
          `${process.env.APP_URL}/security` || 'https://mash.com/security',
        privacyUrl:
          `${process.env.APP_URL}/privacy` || 'https://mash.com/privacy',
      },
    });
  }

  /**
   * Send email changed notification
   */
  async sendEmailChangedNotification(
    oldEmail: string,
    newEmail: string,
    firstName: string,
    changeDate: string,
    ipAddress: string,
    device: string,
    location: string,
    accountUrl: string,
  ): Promise<void> {
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
      supportUrl:
        `${process.env.APP_URL}/support` || 'https://mash.com/support',
      securityUrl:
        `${process.env.APP_URL}/security` || 'https://mash.com/security',
      privacyUrl:
        `${process.env.APP_URL}/privacy` || 'https://mash.com/privacy',
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
  async sendAccountDeletionEmail(
    to: string,
    firstName: string,
    requestDate: string,
    deletionDate: string,
    gracePeriod: string,
    cancelUrl: string,
    downloadDataUrl: string,
    feedbackUrl: string,
  ): Promise<void> {
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
        supportUrl:
          `${process.env.APP_URL}/support` || 'https://mash.com/support',
        privacyUrl:
          `${process.env.APP_URL}/privacy` || 'https://mash.com/privacy',
        termsUrl: `${process.env.APP_URL}/terms` || 'https://mash.com/terms',
      },
    });
  }

  /**
   * Send a raw email (for custom use cases)
   */
  async sendRawEmail(
    to: string,
    subject: string,
    html: string,
    text?: string,
  ): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'MASH System <noreply@mash.com>',
        to,
        subject,
        text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML tags as fallback
        html,
      });

      this.logger.log(
        `Raw email sent successfully to ${to}: ${info.messageId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send raw email to ${to}:`, error);
      throw error;
    }
  }
}
