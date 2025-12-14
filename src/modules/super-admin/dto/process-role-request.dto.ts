import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ProcessRoleRequestDto {
  @ApiPropertyOptional({
    description: 'Admin notes about the decision (optional)',
    example: 'Verified business documentation. Approved.',
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}
