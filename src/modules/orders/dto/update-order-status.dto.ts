import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from './order-query.dto';
import { IsValidOrderStatus } from '../../../common/validators';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'New order status (must be a valid transition)',
    enum: OrderStatus,
  })
  @IsEnum(OrderStatus)
  @IsValidOrderStatus()
  status: OrderStatus;

  @ApiPropertyOptional({ description: 'Status update notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
