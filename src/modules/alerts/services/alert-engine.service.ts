import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AlertRule, AlertCategory, AlertPriority, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { NotificationQueueService } from '../../queues/services/notification-queue.service';

/**
 * Alert Engine Service
 * Evaluates events against alert rules and triggers alerts
 */
@Injectable()
export class AlertEngineService {
  private readonly logger = new Logger(AlertEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationQueue: NotificationQueueService,
  ) {}

  /**
   * Evaluate an event against all active rules
   * @param event The event to evaluate
   * @returns Array of triggered alert rules
   */
  async evaluateEvent(event: {
    eventType: string;
    data: Record<string, any>;
    timestamp?: Date;
  }): Promise<AlertRule[]> {
    this.logger.log(`Evaluating event: ${event.eventType}`);

    // Get all active rules for this event type
    const rules = await this.prisma.alertRule.findMany({
      where: {
        eventType: event.eventType,
        isActive: true,
        isDeleted: false,
      },
      include: {
        recipients: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`Found ${rules.length} active rules for ${event.eventType}`);

    // Evaluate each rule
    const triggeredRules: AlertRule[] = [];

    for (const rule of rules) {
      try {
        // Check if rule should trigger
        if (await this.shouldTrigger(rule, event)) {
          this.logger.log(`Rule triggered: ${rule.name} (${rule.id})`);
          triggeredRules.push(rule);

          // Create alert instance
          await this.createAlert(rule, event);
        }
      } catch (error) {
        this.logger.error(
          `Error evaluating rule ${rule.id}: ${error.message}`,
          error.stack,
        );
      }
    }

    return triggeredRules;
  }

  /**
   * Check if a rule should trigger for the given event
   */
  private async shouldTrigger(
    rule: AlertRule,
    event: { eventType: string; data: Record<string, any>; timestamp?: Date },
  ): Promise<boolean> {
    // 1. Check condition
    if (!this.checkCondition(rule.condition as any, event.data)) {
      return false;
    }

    // 2. Check active hours
    if (!this.isWithinActiveHours(rule.activeHours as any, event.timestamp)) {
      this.logger.log(`Rule ${rule.id} is outside active hours`);
      return false;
    }

    // 3. Check cooldown period
    if (await this.isInCooldown(rule)) {
      this.logger.log(`Rule ${rule.id} is in cooldown period`);
      return false;
    }

    return true;
  }

  /**
   * Evaluate condition against event data
   * Supports operators: GT, LT, GTE, LTE, EQ, NE, BETWEEN, IN, CONTAINS
   */
  private checkCondition(
    condition: {
      field: string;
      operator: string;
      threshold?: number;
      value?: any;
      values?: any[];
      min?: number;
      max?: number;
    },
    data: Record<string, any>,
  ): boolean {
    const fieldValue = this.getNestedValue(data, condition.field);

    if (fieldValue === undefined) {
      return false;
    }

    switch (condition.operator) {
      case 'GT': // Greater than
        return fieldValue > condition.threshold!;

      case 'GTE': // Greater than or equal
        return fieldValue >= condition.threshold!;

      case 'LT': // Less than
        return fieldValue < condition.threshold!;

      case 'LTE': // Less than or equal
        return fieldValue <= condition.threshold!;

      case 'EQ': // Equal
        return fieldValue === condition.value;

      case 'NE': // Not equal
        return fieldValue !== condition.value;

      case 'BETWEEN': // Between min and max
        return (
          fieldValue >= condition.min! && fieldValue <= condition.max!
        );

      case 'IN': // Value in array
        return condition.values?.includes(fieldValue) ?? false;

      case 'CONTAINS': // String contains
        return String(fieldValue)
          .toLowerCase()
          .includes(String(condition.value).toLowerCase());

      case 'REGEX': // Regular expression match
        const regex = new RegExp(condition.value);
        return regex.test(String(fieldValue));

      default:
        this.logger.warn(`Unknown operator: ${condition.operator}`);
        return false;
    }
  }

  /**
   * Get nested value from object using dot notation
   * Example: "sensor.temperature" from { sensor: { temperature: 25 } }
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Check if current time is within active hours
   */
  private isWithinActiveHours(
    activeHours: {
      start?: string;
      end?: string;
      days?: number[];
      timezone?: string;
    } | null,
    timestamp: Date = new Date(),
  ): boolean {
    // If no active hours specified, always active
    if (!activeHours || !activeHours.start || !activeHours.end) {
      return true;
    }

    const now = timestamp;
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Check day of week
    if (activeHours.days && !activeHours.days.includes(dayOfWeek)) {
      return false;
    }

    // Check time range
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return (
      currentTime >= activeHours.start && currentTime <= activeHours.end
    );
  }

  /**
   * Check if rule is in cooldown period
   */
  private async isInCooldown(rule: AlertRule): Promise<boolean> {
    if (rule.cooldownMinutes === 0) {
      return false;
    }

    // Find last alert for this rule
    const lastAlert = await this.prisma.alert.findFirst({
      where: {
        ruleId: rule.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!lastAlert) {
      return false;
    }

    // Calculate cooldown end time
    const cooldownEnd = new Date(
      lastAlert.createdAt.getTime() + rule.cooldownMinutes * 60 * 1000,
    );

    return new Date() < cooldownEnd;
  }

  /**
   * Create an alert instance
   */
  private async createAlert(
    rule: any,
    event: { eventType: string; data: Record<string, any>; timestamp?: Date },
  ) {
    try {
      // Generate fingerprint for deduplication
      const fingerprint = this.generateFingerprint(rule.id, event);

      // Create alert
      const alert = await this.prisma.alert.create({
        data: {
          ruleId: rule.id,
          category: rule.category,
          priority: rule.priority,
          title: this.generateTitle(rule, event),
          message: this.generateMessage(rule, event),
          eventType: event.eventType,
          eventData: event.data as Prisma.JsonObject,
          fingerprint,
          status: 'PENDING',
          metadata: {
            eventTimestamp: event.timestamp?.toISOString() || new Date().toISOString(),
            evaluatedAt: new Date().toISOString(),
          } as Prisma.JsonObject,
          triggeredAt: event.timestamp || new Date(),
        },
      });

      this.logger.log(`Alert created: ${alert.id} for rule ${rule.id}`);
      
      // Send notifications with proper error handling
      try {
        await this.sendNotifications(alert, rule);
      } catch (error) {
        this.logger.error(`Failed to send notifications for alert ${alert.id}: ${error.message}`, error.stack);
        // Continue execution - alert is still created even if notifications fail
      }

      return alert;
    } catch (error) {
      this.logger.error(`Failed to create alert: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(
    alert: any,
    rule: any,
  ): Promise<void> {
    try {
      // Get recipients from rule
      if (!rule.recipients || rule.recipients.length === 0) {
        this.logger.warn(`No recipients configured for rule ${rule.id}`);
        return;
      }

      const emailRecipients = rule.recipients
        .map(r => r.user?.email)
        .filter((email): email is string => !!email);

      if (emailRecipients.length === 0) {
        this.logger.warn(`No email recipients found for rule ${rule.id}`);
        return;
      }

      // Queue email notifications
      await this.notificationQueue.sendEmail({
        to: emailRecipients,
        subject: `🚨 ${this.getPriorityEmoji(alert.priority)} Alert: ${alert.title}`,
        body: alert.message,
        html: this.formatAlertEmail(alert, rule),
        alertId: alert.id,
        priority: alert.priority === 'CRITICAL' ? 'high' : 'normal',
      });

      this.logger.log(`Queued email notifications for alert ${alert.id} to ${emailRecipients.length} recipients`);
    } catch (error) {
      this.logger.error(`Failed to queue notifications: ${error.message}`);
      throw error;
    }
  }

  /**
   * Format alert as HTML email
   */
  private formatAlertEmail(alert: any, rule: AlertRule): string {
    const priorityColor = this.getPriorityColor(alert.priority);
    
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
              background: ${priorityColor};
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
            .alert-info {
              background: white;
              padding: 15px;
              border-radius: 5px;
              margin: 10px 0;
            }
            .label {
              font-weight: bold;
              color: #666;
            }
            .value {
              color: #333;
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
            <h2>${this.getPriorityEmoji(alert.priority)} ${alert.title}</h2>
          </div>
          <div class="content">
            <div class="alert-info">
              <p><span class="label">Priority:</span> <span class="value">${alert.priority}</span></p>
              <p><span class="label">Category:</span> <span class="value">${alert.category}</span></p>
              <p><span class="label">Rule:</span> <span class="value">${rule.name}</span></p>
              <p><span class="label">Triggered At:</span> <span class="value">${new Date(alert.triggeredAt).toLocaleString()}</span></p>
            </div>
            
            <h3>Message</h3>
            <p>${alert.message}</p>
            
            ${alert.eventData ? `
              <h3>Event Data</h3>
              <pre style="background: white; padding: 10px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(alert.eventData, null, 2)}</pre>
            ` : ''}
          </div>
          <div class="footer">
            <p>Alert ID: ${alert.id}</p>
            <p><small>Sent by MASH Mushroom Automation System</small></p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get priority emoji
   */
  private getPriorityEmoji(priority: string): string {
    switch (priority) {
      case 'CRITICAL': return '🔴';
      case 'HIGH': return '🟠';
      case 'MEDIUM': return '🟡';
      case 'LOW': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * Get priority color
   */
  private getPriorityColor(priority: string): string {
    switch (priority) {
      case 'CRITICAL': return '#dc2626'; // red-600
      case 'HIGH': return '#ea580c'; // orange-600
      case 'MEDIUM': return '#ca8a04'; // yellow-600
      case 'LOW': return '#16a34a'; // green-600
      default: return '#6b7280'; // gray-500
    }
  }

  /**
   * Generate alert title
   */
  private generateTitle(
    rule: AlertRule,
    event: { eventType: string; data: Record<string, any> },
  ): string {
    // Use rule name as default title
    let title = rule.name;

    // If rule has a custom message template, use it
    // Template variables: {{fieldName}}
    const condition = rule.condition as any;
    if (condition.field && event.data[condition.field] !== undefined) {
      title = `${rule.name}: ${event.data[condition.field]}`;
    }

    return title;
  }

  /**
   * Generate alert message
   */
  private generateMessage(
    rule: AlertRule,
    event: { eventType: string; data: Record<string, any> },
  ): string {
    const condition = rule.condition as any;
    
    // Build descriptive message
    const parts: string[] = [];
    
    if (condition.field && event.data[condition.field] !== undefined) {
      parts.push(`${condition.field}: ${event.data[condition.field]}`);
    }

    if (condition.operator && condition.threshold !== undefined) {
      parts.push(`${condition.operator} ${condition.threshold}`);
    }

    if (rule.description) {
      parts.push(rule.description);
    }

    return parts.join(' | ');
  }

  /**
   * Generate fingerprint for deduplication
   */
  private generateFingerprint(
    ruleId: string,
    event: { eventType: string; data: Record<string, any> },
  ): string {
    const payload = {
      ruleId,
      eventType: event.eventType,
      // Include relevant data fields for fingerprint
      data: event.data,
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload, Object.keys(payload).sort()))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Manually trigger an alert (for testing)
   */
  async triggerManualAlert(
    ruleId: string,
    data: Record<string, any>,
  ): Promise<any> {
    const rule = await this.prisma.alertRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    return this.createAlert(rule, {
      eventType: rule.eventType,
      data,
      timestamp: new Date(),
    });
  }
}
