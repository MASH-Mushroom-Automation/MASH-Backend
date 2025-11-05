import { EmailTemplateBuilder, EmailTemplateOptions } from './email-template.builder';

/**
 * Pre-configured email templates for MASH system
 * Uses the base template builder with specific configurations
 */

export class MashEmailTemplates {
  private static readonly BACKEND_URL = 'https://mash-backend-api-production.up.railway.app';
  private static readonly FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
  
  /**
   * Welcome/Registration Verification Email
   */
  static registrationVerification(
    firstName: string,
    email: string,
    verificationLink: string,
    expiresIn: string = '24 hours'
  ): { html: string; text: string; subject: string } {
    const bodyContent = `
      <p style="margin: 0 0 15px 0;">Hello <strong>${firstName}</strong>,</p>
      
      <p style="margin: 0 0 15px 0;">
        Welcome to MASH! 🎉 We're thrilled to have you join our Mushroom Automation community.
      </p>
      
      <p style="margin: 0 0 15px 0;">
        To get started and access all the amazing features, please verify your email address by clicking the button below:
      </p>
      
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <p style="margin: 0; color: #856404; font-size: 14px;">
          <strong>⏰ Important:</strong> This verification link will expire in <strong>${expiresIn}</strong>.
        </p>
      </div>
      
      <p style="margin: 20px 0 10px 0; font-size: 14px; color: #666;">
        Or copy and paste this link into your browser:
      </p>
      <p style="margin: 0 0 15px 0; word-break: break-all; font-size: 13px; color: #0066cc; background: #f0f0f0; padding: 10px; border-radius: 4px;">
        ${verificationLink}
      </p>
      
      <p style="margin: 20px 0 0 0; font-size: 14px; color: #777;">
        If you didn't create this account, you can safely ignore this email.
      </p>
    `;

    const options: EmailTemplateOptions = {
      title: 'Verify Your Email Address',
      preheaderText: `Welcome to MASH! Please verify your email to get started.`,
      bodyContent,
      ctaText: 'Verify Email Address',
      ctaUrl: verificationLink,
      ctaColor: '#4CAF50',
    };

    return {
      html: EmailTemplateBuilder.build(options),
      text: EmailTemplateBuilder.buildPlainText(options),
      subject: 'Welcome to MASH - Verify Your Email',
    };
  }

  /**
   * Forgot Password Email
   */
  static forgotPassword(
    firstName: string,
    email: string,
    resetLink: string,
    expiresIn: string = '1 hour'
  ): { html: string; text: string; subject: string } {
    const bodyContent = `
      <p style="margin: 0 0 15px 0;">Hello <strong>${firstName}</strong>,</p>
      
      <p style="margin: 0 0 15px 0;">
        We received a request to reset the password for your MASH account (<strong>${email}</strong>).
      </p>
      
      <p style="margin: 0 0 15px 0;">
        Click the button below to create a new password:
      </p>
      
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <p style="margin: 0; color: #856404; font-size: 14px;">
          <strong>⏰ Security Notice:</strong> This link will expire in <strong>${expiresIn}</strong> for your protection.
        </p>
      </div>
      
      <p style="margin: 20px 0 10px 0; font-size: 14px; color: #666;">
        Or copy and paste this link into your browser:
      </p>
      <p style="margin: 0 0 15px 0; word-break: break-all; font-size: 13px; color: #0066cc; background: #f0f0f0; padding: 10px; border-radius: 4px;">
        ${resetLink}
      </p>
      
      <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <p style="margin: 0; color: #721c24; font-size: 14px;">
          <strong>🔒 Didn't request this?</strong> If you didn't request a password reset, please ignore this email or contact our support team immediately. Your account is still secure.
        </p>
      </div>
    `;

    const options: EmailTemplateOptions = {
      title: 'Reset Your Password',
      preheaderText: 'Reset your MASH account password',
      bodyContent,
      ctaText: 'Reset Password',
      ctaUrl: resetLink,
      ctaColor: '#ff9800',
    };

    return {
      html: EmailTemplateBuilder.build(options),
      text: EmailTemplateBuilder.buildPlainText(options),
      subject: 'Reset Your MASH Password',
    };
  }

  /**
   * Password Changed Confirmation Email
   */
  static passwordChanged(
    firstName: string,
    email: string,
    changeDate: string,
    ipAddress: string
  ): { html: string; text: string; subject: string } {
    const bodyContent = `
      <p style="margin: 0 0 15px 0;">Hello <strong>${firstName}</strong>,</p>
      
      <p style="margin: 0 0 15px 0;">
        This is a confirmation that the password for your MASH account (<strong>${email}</strong>) was successfully changed.
      </p>
      
      <div style="background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <p style="margin: 0 0 10px 0; color: #0c5460; font-size: 14px;">
          <strong>📋 Change Details:</strong>
        </p>
        <p style="margin: 0; color: #0c5460; font-size: 13px;">
          <strong>Date:</strong> ${changeDate}<br>
          <strong>IP Address:</strong> ${ipAddress}
        </p>
      </div>
      
      <p style="margin: 0 0 15px 0;">
        If you made this change, no further action is required.
      </p>
      
      <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <p style="margin: 0; color: #721c24; font-size: 14px;">
          <strong>⚠️ Warning:</strong> If you did NOT make this change, your account may be compromised. Please contact our support team immediately and reset your password.
        </p>
      </div>
    `;

    const options: EmailTemplateOptions = {
      title: 'Password Changed Successfully',
      preheaderText: 'Your MASH password has been changed',
      bodyContent,
      ctaText: 'Contact Support',
      ctaUrl: `${this.BACKEND_URL}/support`,
      ctaColor: '#dc3545',
    };

    return {
      html: EmailTemplateBuilder.build(options),
      text: EmailTemplateBuilder.buildPlainText(options),
      subject: 'Your MASH Password Was Changed',
    };
  }

  /**
   * Two-Factor Authentication Code Email
   */
  static twoFactorCode(
    firstName: string,
    code: string,
    expiresIn: string = '10 minutes'
  ): { html: string; text: string; subject: string } {
    const bodyContent = `
      <p style="margin: 0 0 15px 0;">Hello <strong>${firstName}</strong>,</p>
      
      <p style="margin: 0 0 15px 0;">
        Here is your two-factor authentication code to complete your login:
      </p>
      
      <div style="background: #e7f3ff; border: 2px dashed #2196F3; padding: 30px; margin: 30px 0; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px;">
          Your 2FA Code
        </p>
        <p style="margin: 0; font-size: 36px; font-weight: bold; color: #2196F3; letter-spacing: 8px; font-family: 'Courier New', monospace;">
          ${code}
        </p>
      </div>
      
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <p style="margin: 0; color: #856404; font-size: 14px;">
          <strong>⏰ Quick!</strong> This code will expire in <strong>${expiresIn}</strong>.
        </p>
      </div>
      
      <p style="margin: 20px 0 0 0; font-size: 14px; color: #777;">
        If you didn't request this code, please ignore this email and ensure your account is secure.
      </p>
    `;

    const options: EmailTemplateOptions = {
      title: 'Your 2FA Login Code',
      preheaderText: `Your verification code is: ${code}`,
      bodyContent,
      accentColor: '#2196F3',
    };

    return {
      html: EmailTemplateBuilder.build(options),
      text: EmailTemplateBuilder.buildPlainText(options),
      subject: 'Your MASH Two-Factor Authentication Code',
    };
  }

  /**
   * Order Confirmation Email
   */
  static orderConfirmation(
    firstName: string,
    orderId: string,
    orderTotal: string,
    orderDetailsUrl: string
  ): { html: string; text: string; subject: string } {
    const bodyContent = `
      <p style="margin: 0 0 15px 0;">Hello <strong>${firstName}</strong>,</p>
      
      <p style="margin: 0 0 15px 0;">
        Thank you for your order! 🎉 We've received your purchase and are processing it now.
      </p>
      
      <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <p style="margin: 0 0 10px 0; color: #155724; font-size: 16px;">
          <strong>📦 Order Details:</strong>
        </p>
        <p style="margin: 0; color: #155724; font-size: 14px;">
          <strong>Order ID:</strong> ${orderId}<br>
          <strong>Total Amount:</strong> ${orderTotal}
        </p>
      </div>
      
      <p style="margin: 20px 0 15px 0;">
        We'll send you another email once your order has been shipped with tracking information.
      </p>
      
      <p style="margin: 20px 0 0 0; font-size: 14px; color: #777;">
        Have questions about your order? Contact our support team anytime.
      </p>
    `;

    const options: EmailTemplateOptions = {
      title: 'Order Confirmed!',
      preheaderText: `Your order ${orderId} has been confirmed`,
      bodyContent,
      ctaText: 'View Order Details',
      ctaUrl: orderDetailsUrl,
      ctaColor: '#28a745',
    };

    return {
      html: EmailTemplateBuilder.build(options),
      text: EmailTemplateBuilder.buildPlainText(options),
      subject: `Order Confirmation - ${orderId}`,
    };
  }

  /**
   * Device Alert Notification Email
   */
  static deviceAlert(
    firstName: string,
    deviceName: string,
    alertMessage: string,
    severity: 'critical' | 'warning' | 'info',
    dashboardUrl: string
  ): { html: string; text: string; subject: string } {
    const severityColors = {
      critical: { bg: '#f8d7da', border: '#dc3545', text: '#721c24', icon: '🚨' },
      warning: { bg: '#fff3cd', border: '#ffc107', text: '#856404', icon: '⚠️' },
      info: { bg: '#d1ecf1', border: '#17a2b8', text: '#0c5460', icon: 'ℹ️' },
    };

    const colors = severityColors[severity];

    const bodyContent = `
      <p style="margin: 0 0 15px 0;">Hello <strong>${firstName}</strong>,</p>
      
      <p style="margin: 0 0 15px 0;">
        We detected an issue with your device: <strong>${deviceName}</strong>
      </p>
      
      <div style="background: ${colors.bg}; border-left: 4px solid ${colors.border}; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <p style="margin: 0 0 10px 0; color: ${colors.text}; font-size: 16px;">
          <strong>${colors.icon} ${severity.toUpperCase()} Alert</strong>
        </p>
        <p style="margin: 0; color: ${colors.text}; font-size: 14px;">
          ${alertMessage}
        </p>
      </div>
      
      <p style="margin: 20px 0 15px 0;">
        Please check your device dashboard for more details and take appropriate action.
      </p>
    `;

    const options: EmailTemplateOptions = {
      title: 'Device Alert Notification',
      preheaderText: `${severity.toUpperCase()}: ${deviceName} - ${alertMessage}`,
      bodyContent,
      ctaText: 'View Device Dashboard',
      ctaUrl: dashboardUrl,
      ctaColor: colors.border,
    };

    return {
      html: EmailTemplateBuilder.build(options),
      text: EmailTemplateBuilder.buildPlainText(options),
      subject: `${colors.icon} ${severity.toUpperCase()}: ${deviceName} Alert`,
    };
  }
}
