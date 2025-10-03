import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { CreateDeviceDto } from './create-device.dto';

// Omit userId from updates - users cannot change device ownership via update
export class UpdateDeviceDto extends PartialType(
  OmitType(CreateDeviceDto, ['userId'] as const),
) {}
