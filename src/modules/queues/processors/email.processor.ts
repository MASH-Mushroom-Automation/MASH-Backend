import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationStatus } from '@prisma/client';
import type { EmailNotificationJob } from '../services/notification-queue.service';

// 🔧 TEMPORARILY DISABLED - Processor causes "Cannot define the same handler twice" error
// when Bull is initialized elsewhere (e.g. ImportExportModule)
// @Processor('email-notifications')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(private prisma: PrismaService) {
    // Use your existing Gmail SMTP configuration
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Verify transporter configuration
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error(`Email transporter verification failed: ${error.message}`);
      } else {
        this.logger.log('Email transporter is ready to send messages');
      }
    });
  }

  @Process('send-email')
  async handleEmailJob(job: Job<EmailNotificationJob>) {
    const { to, subject, body, html, alertId, userId } = job.data;

    this.logger.log(`Processing email job ${job.id} for: ${to.join(', ')}`);

    try {
      // Create notification record in database
      const notification = await this.createNotificationRecord(job.data);

      // Send email via Gmail SMTP
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: to.join(', '),
        subject,
        text: body,
        html: html || this.formatAsHtml(body),
      });

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

      this.logger.log(`Email sent successfully: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
        notificationId: notification.id,
      };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);

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
