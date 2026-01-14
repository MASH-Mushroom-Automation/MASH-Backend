import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';

export class RequestRoleChangeDto {
  // ===== USER INFO =====
  @ApiProperty({
    description: 'City where the business is located',
    example: 'Quezon City',
  })
  @IsNotEmpty({ message: 'City is required' })
  @IsString()
  @MaxLength(100)
  city: string;

  @ApiProperty({
    description: 'Region where the business is located',
    example: 'NCR',
  })
  @IsNotEmpty({ message: 'Region is required' })
  @IsString()
  @MaxLength(100)
  region: string;

  @ApiProperty({
    description: 'Complete business address',
    example: 'Unit 123, Brgy. San Antonio, Metro Manila, Philippines',
  })
  @IsNotEmpty({ message: 'Complete address is required' })
  @IsString()
  @MaxLength(500)
  completeAddress: string;

  // ===== BUSINESS INFO =====
  @ApiProperty({
    description: 'Business name or farm name',
    example: 'Manila Mushroom Farm',
  })
  @IsNotEmpty({ message: 'Business name is required' })
  @IsString()
  @MaxLength(200)
  businessName: string;

  @ApiProperty({
    description: 'Type of business (e.g., Sole Proprietor, Corporation, Partnership, Cooperative)',
    example: 'Sole Proprietor',
  })
  @IsNotEmpty({ message: 'Business type is required' })
  @IsString()
  @MaxLength(100)
  businessType: string;

  // ===== PRODUCT INFO =====
  @ApiProperty({
    description: 'Types of mushrooms grown/sold',
    example: ['Oyster', 'Shiitake', 'Button'],
    type: [String],
  })
  @IsNotEmpty({ message: 'At least one mushroom type is required' })
  @IsArray()
  @IsString({ each: true })
  mushroomTypes: string[];

  @ApiProperty({
    description: 'Monthly production capacity',
    example: '500-1000 kg',
  })
  @IsNotEmpty({ message: 'Monthly production capacity is required' })
  @IsString()
  @MaxLength(100)
  monthlyProductionCapacity: string;

  @ApiProperty({
    description: 'Certifications held (e.g., Organic, GAP, HACCP)',
    example: ['Organic', 'GAP'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  // ===== BUSINESS DOCUMENTS =====
  @ApiProperty({
    description: 'Valid government-issued ID of owner (image URL)',
    example: 'https://s3.bucket.com/user123/government-id.jpg',
  })
  @IsNotEmpty({ message: 'Valid ID is required' })
  @IsUrl({}, { message: 'Must be a valid URL' })
  governmentId: string;

  @ApiProperty({
    description: 'BIR Certificate of Registration (COR) with TIN',
    example: 'https://s3.bucket.com/user123/bir-certificate.pdf',
  })
  @IsNotEmpty({ message: 'BIR Certificate is required' })
  @IsUrl({}, { message: 'Must be a valid URL' })
  birCertificate: string;

  @ApiProperty({
    description:
      'DTI Certificate (sole proprietors) or SEC Certificate (corporations/partnerships)',
    example: 'https://s3.bucket.com/user123/business-certificate.pdf',
  })
  @IsNotEmpty({ message: 'Business Certificate is required' })
  @IsUrl({}, { message: 'Must be a valid URL' })
  businessCertificate: string;

  // ===== OPTIONAL =====
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
