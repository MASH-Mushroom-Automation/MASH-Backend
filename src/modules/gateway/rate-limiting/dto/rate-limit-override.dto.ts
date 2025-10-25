import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RateLimitStrategy } from '@prisma/client';

/**
 * CreateRateLimitOverrideDto
 *
 * DTO for creating custom rate limit overrides for specific users/API keys
 */
export class CreateRateLimitOverrideDto {
  @ApiPropertyOptional({
    description: 'User ID (leave empty for anonymous/guest)',
    example: 'user_2abc123def',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'API key (for API key-based limits)',
    example: 'sk_live_1234567890',
  })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiProperty({
    description: 'Endpoint to apply limit to (e.g., /api/v1/orders)',
    example: '/api/v1/orders',
  })
  @IsString()
  endpoint: string;

  @ApiProperty({
    description: 'Maximum number of requests allowed',
    example: 200,
    minimum: 1,
    maximum: 100000,
  })
  @IsInt()
  @Min(1)
  @Max(100000)
  requestLimit: number;

  @ApiProperty({
    description: 'Time window in milliseconds',
    example: 60000,
    minimum: 1000,
    maximum: 86400000,
  })
  @IsInt()
  @Min(1000)
  @Max(86400000) // 24 hours max
  timeWindowMs: number;

  @ApiProperty({
    description: 'Rate limiting strategy',
    enum: RateLimitStrategy,
    example: RateLimitStrategy.TOKEN_BUCKET,
  })
  @IsEnum(RateLimitStrategy)
  strategy: RateLimitStrategy;

  @ApiPropertyOptional({
    description: 'Priority (higher = checked first)',
    example: 100,
    minimum: 0,
    maximum: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Reason for override',
    example: 'Premium user with higher limits',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Expiration date (ISO 8601)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

/**
 * UpdateRateLimitOverrideDto
 *
 * All fields optional for partial updates
 */
export class UpdateRateLimitOverrideDto {
  @ApiPropertyOptional({
    description: 'Maximum number of requests allowed',
    example: 300,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  requestLimit?: number;

  @ApiPropertyOptional({
    description: 'Time window in milliseconds',
    example: 120000,
  })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(86400000)
  timeWindowMs?: number;

  @ApiPropertyOptional({
    description: 'Rate limiting strategy',
    enum: RateLimitStrategy,
  })
  @IsOptional()
  @IsEnum(RateLimitStrategy)
  strategy?: RateLimitStrategy;

  @ApiPropertyOptional({
    description: 'Priority',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Reason for override',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Expiration date',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
