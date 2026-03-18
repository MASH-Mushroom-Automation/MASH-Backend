import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import axios from 'axios';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationStatus } from '@prisma/client';
import type { EmailNotificationJob } from '../services/notification-queue.service';

@Processor('email-notifications')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(private prisma: PrismaService) {
    super();
    // Configure default SMTP (fallback)
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
    });

    // Verify transporter configuration
    this.transporter.verify(error => {
      if (error) {
        this.logger.error(`SMTP Email transporter verification failed: ${error.message}`);
      } else {
        this.logger.log('SMTP Email transporter is ready to send messages');
      }
    });
  }

  async process(job: Job<EmailNotificationJob, any, string>): Promise<any> {
    const { to, subject, body, html, alertId, userId } = job.data;

    this.logger.log(`Processing email job ${job.id} for: ${to.join(', ')}`);

    try {
      // Create notification record in database
      const notification = await this.createNotificationRecord(job.data);

      const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
      const resendApiKey = process.env.RESEND_API || process.env.RESEND_API_KEY;

      let info;

      if (resendApiKey) {
        // Try Resend API first (Fast and reliable)
        // Resend requires a verified domain - gmail.com will NOT work
        const resendFromEmail =
          process.env.RESEND_FROM_EMAIL ||
          process.env.RESEND_FROM ||
          fromEmail;

        try {
          const response = await axios.post(
            'https://api.resend.com/emails',
            {
              from: resendFromEmail,
              to: to,
              subject,
              text: body,
              html: html || this.formatAsHtml(body),
            },
            {
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              timeout: 10000,
            },
          );
          this.logger.log(`✅ Email sent successfully via Resend API: ${to.join(', ')}`);
          info = { messageId: response.data?.id || 'resend-api-' + Date.now(), response: 'ok' };
        } catch (resendError) {
          const errMsg = resendError?.response?.data?.message || resendError.message;
          this.logger.warn(`Resend API failed (from: ${resendFromEmail}), falling back to SMTP: ${errMsg}`);
        }
      }

      if (!info) {
        // Send email via Gmail SMTP (fallback)
        info = await this.transporter.sendMail({
          from: fromEmail,
          to: to.join(', '),
          subject,
          text: body,
          html: html || this.formatAsHtml(body),
        });
        this.logger.log(`✅ Email sent successfully via SMTP: ${info.messageId}`);
      }

      // Update notification status to SENT
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          deliveredAt: new Date(),
          metadata: {
            messageId: info.messageId,
            response: info.response,
          },
        },
      });

      return {
        success: true,
        messageId: info.messageId,
        notificationId: notification.id,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to send email job ${job.id}: ${error.message}`);

      // Update notification status to FAILED
      try {
        await this.prisma.notification.updateMany({
          where: {
            alertId: job.data.alertId,
            channel: 'EMAIL',
            status: NotificationStatus.PENDING,
          },
          data: {
            status: NotificationStatus.FAILED,
            failedAt: new Date(),
            metadata: {
              error: error.message,
              stack: error.stack,
            },
          },
        });
      } catch (dbError) {
        this.logger.error(`Failed to update notification status: ${dbError.message}`);
      }

      throw error; // Bull will retry based on job configuration
    }
  }

  /**
   * Create notification record in database
   */
  private async createNotificationRecord(data: EmailNotificationJob) {
    return this.prisma.notification.create({
      data: {
        alertId: data.alertId || null,
        userId: data.userId || null,
        channel: 'EMAIL',
        status: NotificationStatus.PENDING,
        recipientEmail: data.to[0], // Primary recipient
        subject: data.subject,
        body: data.body,
        metadata: {
          allRecipients: data.to,
          priority: data.priority || 'normal',
          templateId: data.templateId,
        },
        queuedAt: new Date(),
      },
    });
  }

  /**
   * Format plain text as HTML
   */
  private formatAsHtml(text: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 20px;
              border-radius: 5px 5px 0 0;
              text-align: center;
            }
            .content {
              background: #f9f9f9;
              padding: 20px;
              border: 1px solid #ddd;
              border-top: none;
            }
            .footer {
              text-align: center;
              padding: 10px;
              font-size: 12px;
              color: #666;
              border-top: 1px solid #ddd;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>🍄 MASH Notification</h2>
          </div>
          <div class="content">
            ${text
              .split('\n')
              .map(line => `<p>${line}</p>`)
              .join('')}
          </div>
          <div class="footer">
            <p>Sent by MASH Mushroom Automation System</p>
            <p><small>This is an automated notification. Please do not reply to this email.</small></p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Test email sending (for development)
   */
  async testEmail(to: string): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject: 'Test Email from MASH System',
        text: 'This is a test email to verify your email configuration is working correctly.',
        html: this.formatAsHtml(
          'This is a test email to verify your email configuration is working correctly.',
        ),
      });

      this.logger.log(`Test email sent: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Test email failed: ${error.message}`);
      throw error;
    }
  }
}
