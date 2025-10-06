import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../users/dto/pagination-query.dto';
import { DeviceType } from './create-device.dto';

// Use Prisma enum for DeviceStatus
export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  MAINTENANCE = 'MAINTENANCE',
  ERROR = 'ERROR',
}

export class DeviceFilterQueryDto extends PaginationQueryDto {
  @ApiProperty({
    description: 'Filter by device type',
    enum: DeviceType,
    required: false,
  })
  @IsEnum(DeviceType)
  @IsOptional()
  type?: DeviceType;

  @ApiProperty({
    description: 'Filter by device status',
    enum: DeviceStatus,
    required: false,
  })
  @IsEnum(DeviceStatus)
  @IsOptional()
  status?: DeviceStatus;

  @ApiProperty({
    description: 'Search by device name or location',
    required: false,
  })
  @IsString()
  @IsOptional()
  search?: string;
}
