import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'Name for the API key (e.g., "Production API", "Testing Key")',
    example: 'Production API',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    description: 'Array of scopes/permissions for this API key',
    example: ['read', 'write', 'devices:read', 'orders:create'],
    default: ['read'],
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  scopes?: string[];

  @ApiPropertyOptional({
    description: 'Optional expiration date for the API key (ISO 8601 format)',
    example: '2026-10-07T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
