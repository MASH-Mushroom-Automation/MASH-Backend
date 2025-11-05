import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, IsOptional, IsEnum } from 'class-validator';

export enum DeviceCommand {
  START = 'START',
  STOP = 'STOP',
  RESTART = 'RESTART',
  RESET = 'RESET',
  CONFIGURE = 'CONFIGURE',
  CALIBRATE = 'CALIBRATE',
  UPDATE_FIRMWARE = 'UPDATE_FIRMWARE',
  REQUEST_STATUS = 'REQUEST_STATUS',
}

export class DeviceCommandDto {
  @ApiProperty({
    description: 'Command to send to device',
    enum: DeviceCommand,
    example: DeviceCommand.START,
  })
  @IsEnum(DeviceCommand)
  @IsNotEmpty()
  command: DeviceCommand;

  @ApiProperty({
    description: 'Command parameters as JSON object',
    example: { duration: 3600, mode: 'auto' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  parameters?: any;
}
