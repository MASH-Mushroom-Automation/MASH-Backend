import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateAlertRuleDto } from '../dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from '../dto/update-alert-rule.dto';
import { AlertRule, Prisma } from '@prisma/client';

/**
 * Alert Rule Service
 * Manages CRUD operations for alert rules
 */
@Injectable()
export class AlertRuleService {
  private readonly logger = new Logger(AlertRuleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new alert rule
   */
  async create(dto: CreateAlertRuleDto, userId: string): Promise<AlertRule> {
    this.logger.log(`Creating alert rule: ${dto.name}`);

    // Create the alert rule
    const alertRule = await this.prisma.alertRule.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        priority: dto.priority,
        eventType: dto.eventType,
        condition: dto.condition as Prisma.JsonObject,
        activeHours: (dto.activeHours as Prisma.JsonObject) ?? null,
        cooldownMinutes: dto.cooldownMinutes ?? 15,
        isActive: dto.isActive ?? true,
        createdBy: userId,
        updatedBy: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(`Alert rule created: ${alertRule.id}`);
    return alertRule;
  }

  /**
   * Find all alert rules with optional filtering
   */
  async findAll(filters?: {
    category?: string;
    priority?: string;
    isActive?: boolean;
  }): Promise<AlertRule[]> {
    const where: Prisma.AlertRuleWhereInput = {};

    if (filters?.category) {
      where.category = filters.category as any;
    }
    if (filters?.priority) {
      where.priority = filters.priority as any;
    }
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.prisma.alertRule.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
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
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Find a single alert rule by ID
   */
  async findOne(id: string): Promise<AlertRule> {
    const alertRule = await this.prisma.alertRule.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        updater: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
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
        alerts: {
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!alertRule) {
      throw new NotFoundException(`Alert rule with ID '${id}' not found`);
    }

    return alertRule;
  }

  /**
   * Update an existing alert rule
   */
  async update(id: string, dto: UpdateAlertRuleDto, userId: string): Promise<AlertRule> {
    this.logger.log(`Updating alert rule: ${id}`);

    // Check if rule exists
    await this.findOne(id);

    // Update the rule
    const updated = await this.prisma.alertRule.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category && { category: dto.category }),
        ...(dto.priority && { priority: dto.priority }),
        ...(dto.eventType && { eventType: dto.eventType }),
        ...(dto.condition && { condition: dto.condition as Prisma.JsonObject }),
        ...(dto.activeHours !== undefined && {
          activeHours: dto.activeHours as Prisma.JsonObject,
        }),
        ...(dto.cooldownMinutes !== undefined && {
          cooldownMinutes: dto.cooldownMinutes,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedBy: userId,
        updatedAt: new Date(),
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        updater: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(`Alert rule updated: ${id}`);
    return updated;
  }

  /**
   * Delete an alert rule
   */
  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting alert rule: ${id}`);

    // Check if rule exists
    await this.findOne(id);

    // Delete the rule (cascade will handle related records)
    await this.prisma.alertRule.delete({
      where: { id },
    });

    this.logger.log(`Alert rule deleted: ${id}`);
  }

  /**
   * Toggle alert rule active status
   */
  async toggleActive(id: string, userId: string): Promise<AlertRule> {
    const rule = await this.findOne(id);

    return this.prisma.alertRule.update({
      where: { id },
      data: {
        isActive: !rule.isActive,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get active rules for a specific category
   */
  async getActiveRulesByCategory(category: string): Promise<AlertRule[]> {
    return this.prisma.alertRule.findMany({
      where: {
        category: category as any,
        isActive: true,
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
  }
}
