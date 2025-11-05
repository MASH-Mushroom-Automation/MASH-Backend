import { IsString, IsInt, IsOptional, IsEnum, Min, Max, IsDateString } from 'class-validator';
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

/**
 * RateLimitOverrideResponseDto
 *
 * Response DTO for rate limit override with user information
 */
export class RateLimitOverrideResponseDto {
  @ApiProperty({ description: 'Override ID', example: 'clx1234567890' })
  id: string;

  @ApiPropertyOptional({
    description: 'User ID',
    example: 'user_2abc123def',
    nullable: true,
  })
  userId: string | null;

  @ApiPropertyOptional({
    description: 'API key',
    example: 'sk_live_1234567890',
    nullable: true,
  })
  apiKey: string | null;

  @ApiProperty({ description: 'Endpoint', example: '/api/v1/orders' })
  endpoint: string;

  @ApiProperty({ description: 'Request limit', example: 200 })
  requestLimit: number;

  @ApiProperty({ description: 'Time window (ms)', example: 60000 })
  timeWindowMs: number;

  @ApiProperty({
    description: 'Strategy',
    enum: RateLimitStrategy,
    example: RateLimitStrategy.TOKEN_BUCKET,
  })
  strategy: RateLimitStrategy;

  @ApiProperty({ description: 'Priority', example: 100 })
  priority: number;

  @ApiProperty({
    description: 'Reason',
    example: 'Premium user with higher limits',
  })
  reason: string;

  @ApiPropertyOptional({
    description: 'Expiration date',
    example: '2025-12-31T23:59:59Z',
    nullable: true,
  })
  expiresAt: Date | null;

  @ApiProperty({ description: 'Created at', example: '2025-01-01T00:00:00Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at', example: '2025-01-01T00:00:00Z' })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'User information',
    type: 'object',
    properties: {
      id: { type: 'string' },
      email: { type: 'string' },
    },
  })
  user?: {
    id: string;
    email: string;
  };
}

/**
 * PaginatedOverridesResponseDto
 *
 * Response DTO for paginated list of overrides
 */
export class PaginatedOverridesResponseDto {
  @ApiProperty({
    description: 'List of overrides',
    type: [RateLimitOverrideResponseDto],
  })
  overrides: RateLimitOverrideResponseDto[];

  @ApiProperty({ description: 'Total count', example: 150 })
  total: number;

  @ApiProperty({ description: 'Skip offset', example: 0 })
  skip: number;

  @ApiProperty({ description: 'Take limit', example: 20 })
  take: number;
}

/**
 * RateLimitUsageResponseDto
 *
 * Response DTO for current rate limit usage
 */
export class RateLimitUsageResponseDto {
  @ApiProperty({
    description: 'Identifier',
    example: 'user_2abc123def',
  })
  identifier: string;

  @ApiProperty({ description: 'Endpoint', example: '/api/v1/orders' })
  endpoint: string;

  @ApiProperty({ description: 'Request allowed', example: true })
  allowed: boolean;

  @ApiProperty({ description: 'Limit', example: 100 })
  limit: number;

  @ApiProperty({ description: 'Remaining', example: 85 })
  remaining: number;

  @ApiProperty({
    description: 'Reset time',
    example: '2025-01-15T12:00:00Z',
  })
  resetAt: Date;

  @ApiPropertyOptional({
    description: 'Retry after (ms)',
    example: 30000,
  })
  retryAfterMs?: number;

  @ApiProperty({ description: 'Strategy', example: 'TOKEN_BUCKET' })
  strategy: string;

  @ApiProperty({
    description: 'Statistics',
    type: 'object',
    properties: {
      violations24h: { type: 'number' },
      violations1h: { type: 'number' },
    },
  })
  stats: {
    violations24h: number;
    violations1h: number;
  };
}

/**
 * RateLimitViolationDto
 *
 * Response DTO for rate limit violation
 */
export class RateLimitViolationDto {
  @ApiProperty({ description: 'Violation ID', example: 'clx1234567890' })
  id: string;

  @ApiProperty({
    description: 'Identifier',
    example: 'user_2abc123def',
  })
  identifier: string;

  @ApiProperty({ description: 'Endpoint', example: '/api/v1/orders' })
  endpoint: string;

  @ApiProperty({
    description: 'Violation timestamp',
    example: '2025-01-15T12:00:00Z',
  })
  violatedAt: Date;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: 'object',
    additionalProperties: true,
  })
  metadata?: Record<string, any>;
}

/**
 * ViolationStatsResponseDto
 *
 * Response DTO for violation statistics
 */
export class ViolationStatsResponseDto {
  @ApiProperty({
    description: 'Identifier',
    example: 'user_2abc123def',
  })
  identifier: string;

  @ApiProperty({ description: 'Total violations', example: 150 })
  totalViolations: number;

  @ApiProperty({ description: 'Violations in last 24 hours', example: 45 })
  last24Hours: number;

  @ApiProperty({ description: 'Violations in last 1 hour', example: 12 })
  last1Hour: number;

  @ApiProperty({
    description: 'Most violated endpoints',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        endpoint: { type: 'string' },
        count: { type: 'number' },
      },
    },
  })
  mostViolatedEndpoints: Array<{
    endpoint: string;
    count: number;
  }>;

  @ApiPropertyOptional({
    description: 'First violation',
    example: '2025-01-01T00:00:00Z',
    nullable: true,
  })
  firstViolation: Date | null;

  @ApiPropertyOptional({
    description: 'Last violation',
    example: '2025-01-15T12:00:00Z',
    nullable: true,
  })
  lastViolation: Date | null;
}

/**
 * AbusePatternResponseDto
 *
 * Response DTO for abuse pattern detection
 */
export class AbusePatternResponseDto {
  @ApiProperty({
    description: 'Identifier',
    example: 'user_2abc123def',
  })
  identifier: string;

  @ApiProperty({ description: 'Risk score (0-100)', example: 75 })
  riskScore: number;

  @ApiProperty({
    description: 'Risk level',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    example: 'HIGH',
  })
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiProperty({
    description: 'Recommendation',
    enum: ['MONITOR', 'WARN', 'THROTTLE', 'BLOCK'],
    example: 'THROTTLE',
  })
  recommendation: 'MONITOR' | 'WARN' | 'THROTTLE' | 'BLOCK';

  @ApiProperty({
    description: 'Analysis details',
    type: 'object',
    properties: {
      totalViolations: { type: 'number' },
      violations24h: { type: 'number' },
      violations1h: { type: 'number' },
      uniqueEndpoints: { type: 'number' },
      averageViolationsPerHour: { type: 'number' },
      peakViolationRate: { type: 'number' },
    },
  })
  analysis: {
    totalViolations: number;
    violations24h: number;
    violations1h: number;
    uniqueEndpoints: number;
    averageViolationsPerHour: number;
    peakViolationRate: number;
  };

  @ApiProperty({
    description: 'Reasoning',
    type: [String],
    example: ['High violation rate in the last hour', 'Multiple endpoints hit'],
  })
  reasoning: string[];
}

/**
 * TestRateLimitDto
 *
 * DTO for testing rate limit configuration
 */
export class TestRateLimitDto {
  @ApiProperty({
    description: 'Identifier (user ID or IP address)',
    example: 'user_2abc123def',
  })
  @IsString()
  identifier: string;

  @ApiProperty({
    description: 'Endpoint to test',
    example: '/api/v1/orders',
  })
  @IsString()
  endpoint: string;

  @ApiProperty({
    description: 'HTTP method',
    example: 'GET',
  })
  @IsString()
  method: string;

  @ApiPropertyOptional({
    description: 'Number of requests to simulate',
    example: 10,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  requestCount?: number;
}
