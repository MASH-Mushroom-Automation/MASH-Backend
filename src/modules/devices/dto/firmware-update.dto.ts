import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUrl, MaxLength } from 'class-validator';

export class FirmwareUpdateDto {
  @ApiProperty({
    description: 'Firmware version',
    example: '2.1.0',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  version: string;

  @ApiProperty({
    description: 'URL to firmware file',
    example: 'https://firmware.example.com/device-v2.1.0.bin',
  })
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @ApiProperty({
    description: 'SHA256 checksum of firmware file',
    example: 'a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  checksum: string;
}
