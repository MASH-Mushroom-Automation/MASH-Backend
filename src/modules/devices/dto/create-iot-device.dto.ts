import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsObject, MaxLength, IsBoolean } from 'class-validator';
import { DeviceType } from './create-device.dto';
import { DeviceStatus } from './device-filter-query.dto';

export class CreateIoTDeviceDto {
  @ApiProperty({
    description: 'Device name',
    example: 'MASH Chamber A1',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Device type',
    enum: DeviceType,
    example: DeviceType.MUSHROOM_CHAMBER,
  })
  @IsEnum(DeviceType)
  @IsNotEmpty()
  type: DeviceType;

  @ApiProperty({
    description: 'Device serial number',
    example: 'MASH-A1-CAL25-D5A91F',
  })
  @IsString()
  @IsNotEmpty()
  serialNumber: string;

  @ApiProperty({
    description: 'Device location',
    example: 'Growing Room A - Shelf 3',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  location?: string;

  @ApiProperty({
    description: 'Device firmware version',
    example: '1.0.0',
    required: false,
  })
  @IsString()
  @IsOptional()
  firmware?: string;

  @ApiProperty({
    description: 'Device IP address',
    example: '192.168.1.50',
    required: false,
  })
  @IsString()
  @IsOptional()
  ipAddress?: string;

  @ApiProperty({
    description: 'Device MAC address',
    example: '00:11:22:33:44:55',
    required: false,
  })
  @IsString()
  @IsOptional()
  macAddress?: string;

  @ApiProperty({
    description: 'Device status',
    enum: DeviceStatus,
    example: DeviceStatus.ONLINE,
    required: false,
  })
  @IsEnum(DeviceStatus)
  @IsOptional()
  status?: DeviceStatus;

  @ApiProperty({
    description: 'Device active status',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: 'User ID who owns this device',
    example: 'user-uuid-123',
    required: false,
  })
  @IsString()
  @IsOptional()
  userId?: string;
}
