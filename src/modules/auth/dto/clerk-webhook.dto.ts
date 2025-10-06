import { IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClerkWebhookDto {
  @ApiProperty({
    description: 'The type of webhook event',
    example: 'user.created',
    enum: ['user.created', 'user.updated', 'user.deleted'],
  })
  @IsString()
  type: string;

  @ApiProperty({
    description: 'The event data payload',
    type: Object,
    additionalProperties: true,
  })
  @IsObject()
  data: Record<string, any>;

  @ApiProperty({
    description: 'The object type (usually "event")',
    example: 'event',
  })
  @IsString()
  @IsOptional()
  object?: string;
}
