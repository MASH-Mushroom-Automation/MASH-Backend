import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUrl, IsInt, IsBoolean, IsEnum, IsOptional, Min, Max } from 'class-validator';
import { LoadBalancingStrategy } from '@prisma/client';

export class CreateGatewayConfigDto {
  @ApiProperty({ description: 'Unique service name' })
  @IsString()
  serviceName: string;

  @ApiProperty({ description: 'Base path for routing (e.g., /api/v1/orders)' })
  @IsString()
  basePath: string;

  @ApiProperty({ description: 'Target service URL' })
  @IsUrl()
  targetUrl: string;

  @ApiPropertyOptional({ description: 'Health check endpoint URL' })
  @IsOptional()
  @IsUrl()
  healthCheckUrl?: string;

  @ApiPropertyOptional({
    description: 'Request timeout in milliseconds',
    default: 30000,
  })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(300000)
  timeout?: number;

  @ApiPropertyOptional({
    description: 'Number of retry attempts',
    default: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  retryAttempts?: number;

  @ApiPropertyOptional({
    description: 'Enable circuit breaker',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  circuitBreaker?: boolean;

  @ApiPropertyOptional({
    description: 'Load balancing strategy',
    enum: LoadBalancingStrategy,
    default: LoadBalancingStrategy.ROUND_ROBIN,
  })
  @IsOptional()
  @IsEnum(LoadBalancingStrategy)
  loadBalancing?: LoadBalancingStrategy;

  @ApiPropertyOptional({
    description: 'Route priority (higher = first)',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateGatewayConfigDto {
  @ApiPropertyOptional({ description: 'Base path for routing' })
  @IsOptional()
  @IsString()
  basePath?: string;

  @ApiPropertyOptional({ description: 'Target service URL' })
  @IsOptional()
  @IsUrl()
  targetUrl?: string;

  @ApiPropertyOptional({ description: 'Health check endpoint URL' })
  @IsOptional()
  @IsUrl()
  healthCheckUrl?: string;

  @ApiPropertyOptional({ description: 'Request timeout in milliseconds' })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(300000)
  timeout?: number;

  @ApiPropertyOptional({ description: 'Number of retry attempts' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  retryAttempts?: number;

  @ApiPropertyOptional({ description: 'Enable circuit breaker' })
  @IsOptional()
  @IsBoolean()
  circuitBreaker?: boolean;

  @ApiPropertyOptional({
    description: 'Load balancing strategy',
    enum: LoadBalancingStrategy,
  })
  @IsOptional()
  @IsEnum(LoadBalancingStrategy)
  loadBalancing?: LoadBalancingStrategy;

  @ApiPropertyOptional({ description: 'Is route active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Route priority' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}
