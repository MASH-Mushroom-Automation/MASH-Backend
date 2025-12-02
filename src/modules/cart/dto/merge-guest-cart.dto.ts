import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MergeGuestCartDto {
  @ApiPropertyOptional({
    description: 'Guest session ID to merge from (auto-detected from cookies if not provided)',
    example: 'guest_abc123def456...',
  })
  @IsOptional()
  @IsString()
  guestSessionId?: string;
}
