import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsUrl,
  ValidateIf,
} from 'class-validator';

export class RequestRoleChangeDto {
  @ApiProperty({
    description: 'Valid government-issued ID (image URL)',
    example: 'https://s3.bucket.com/user123/government-id.jpg',
  })
  @IsNotEmpty({ message: 'Government-issued ID is required' })
  @IsUrl({}, { message: 'Must be a valid URL' })
  governmentId: string;

  @ApiProperty({
    description:
      'DTI Certificate (sole proprietors) or SEC Certificate (corporations/partnerships)',
    example: 'https://s3.bucket.com/user123/dti-certificate.pdf',
  })
  @IsNotEmpty({ message: 'DTI or SEC Certificate is required' })
  @IsUrl({}, { message: 'Must be a valid URL' })
  businessCertificate: string;

  @ApiProperty({
    description: 'BIR Certificate of Registration (COR) with TIN',
    example: 'https://s3.bucket.com/user123/bir-certificate.pdf',
  })
  @IsNotEmpty({ message: 'BIR Certificate is required' })
  @IsUrl({}, { message: 'Must be a valid URL' })
  birCertificate: string;

  @ApiProperty({
    description: 'Bank account documentation for payouts',
    example: 'https://s3.bucket.com/user123/bank-account.pdf',
  })
  @IsNotEmpty({ message: 'Bank account documentation is required' })
  @IsUrl({}, { message: 'Must be a valid URL' })
  bankAccountDocumentation: string;

  @ApiProperty({
    description: 'Business name or farm name',
    example: 'Manila Mushroom Farm',
  })
  @IsNotEmpty({ message: 'Business name is required' })
  @IsString()
  @MaxLength(200)
  businessName: string;

  @ApiProperty({
    description: 'Business address',
    example: 'Unit 123, Metro Manila, Philippines',
  })
  @IsNotEmpty({ message: 'Business address is required' })
  @IsString()
  @MaxLength(500)
  businessAddress: string;

  @ApiProperty({
    description: 'Additional information about your business',
    example: 'We have been growing organic mushrooms for 5 years',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  additionalInfo?: string;
}
