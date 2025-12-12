import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export class BulkProcessRequestsDto {
  @ApiProperty({
    description: 'Array of request IDs to process',
    example: ['req_123', 'req_456', 'req_789'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one request ID is required' })
  @IsString({ each: true })
  requestIds: string[];

  @ApiPropertyOptional({
    description: 'Admin notes to apply to all requests',
    example: 'Bulk approval - verified documents',
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}
