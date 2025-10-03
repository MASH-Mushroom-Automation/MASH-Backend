import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({
    example: '123 Main Street',
    description: 'Street address',
  })
  @IsString()
  street: string;

  @ApiProperty({
    example: 'New York',
    description: 'City',
  })
  @IsString()
  city: string;

  @ApiProperty({
    example: 'NY',
    description: 'State or province',
  })
  @IsString()
  state: string;

  @ApiProperty({
    example: '10001',
    description: 'Postal/ZIP code',
  })
  @IsString()
  zipCode: string;

  @ApiProperty({
    example: 'USA',
    description: 'Country',
  })
  @IsString()
  country: string;

  @ApiProperty({
    example: true,
    description: 'Set as default address',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
