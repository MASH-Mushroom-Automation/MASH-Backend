import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ProcessRoleRequestDto {
  @ApiProperty({
    description: 'Whether to approve or reject the request',
    example: true,
  })
  @IsBoolean()
  approve: boolean;

  @ApiPropertyOptional({
    description: 'Admin notes about the decision (optional)',
    example: 'Verified business documentation. Approved.',
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}
