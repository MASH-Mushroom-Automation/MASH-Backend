import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';

/**
 * Update Order DTO - Partial version of CreateOrderDto
 * Excludes userId as it cannot be changed after order creation
 */
export class UpdateOrderDto extends PartialType(
  OmitType(CreateOrderDto, ['userId', 'items'] as const),
) {}
