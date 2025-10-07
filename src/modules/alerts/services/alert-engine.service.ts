import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AlertRule, AlertCategory, AlertPriority, Prisma } from '@prisma/client';
import * as crypto from 'crypto';

/**
 * Alert Engine Service
 * Evaluates events against alert rules and triggers alerts
 */
@Injectable()
export class AlertEngineService {
  private readonly logger = new Logger(AlertEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    rule: AlertRule,
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
      return alert;
    } catch (error) {
      this.logger.error(`Failed to create alert: ${error.message}`, error.stack);
      throw error;
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
      .update(JSON.stringify(payload))
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
