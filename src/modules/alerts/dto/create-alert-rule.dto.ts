import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsObject,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AlertCategory,
  AlertPriority,
} from '@prisma/client';

/**
 * DTO for creating an alert rule
 * Defines when and how alerts should be triggered
 */
export class CreateAlertRuleDto {
  @ApiProperty({
    description: 'Unique name for the alert rule',
    example: 'High Temperature Warning',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Human-readable description of the rule',
    example: 'Alert when temperature exceeds 30°C',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Alert category',
    enum: AlertCategory,
    example: AlertCategory.SENSOR,
  })
  @IsEnum(AlertCategory)
  category: AlertCategory;

  @ApiProperty({
    description: 'Alert priority level',
    enum: AlertPriority,
    example: AlertPriority.HIGH,
  })
  @IsEnum(AlertPriority)
  priority: AlertPriority;

  @ApiProperty({
    description: 'Event type to monitor',
    example: 'sensor.temperature',
  })
  @IsString()
  eventType: string;

  @ApiProperty({
    description: 'Rule evaluation condition (JSON)',
    example: {
      field: 'value',
      operator: 'GT',
      threshold: 30,
      unit: 'celsius',
    },
  })
  @IsObject()
  condition: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Active time window configuration',
    example: {
      start: '09:00',
      end: '17:00',
      days: [1, 2, 3, 4, 5],
      timezone: 'UTC',
    },
  })
  @IsObject()
  @IsOptional()
  activeHours?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Cooldown period in minutes',
    example: 15,
    default: 15,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  cooldownMinutes?: number;

  @ApiProperty({
    description: 'Whether the rule is active',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

