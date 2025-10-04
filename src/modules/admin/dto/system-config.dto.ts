import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class SystemConfigDto {
  @ApiProperty({
    description: 'Configuration key',
    example: 'site_name',
  })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({
    description: 'Configuration value',
    example: 'MASH Backend',
  })
  @IsNotEmpty()
  value: any;

  @ApiProperty({
    description: 'Optional metadata',
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
