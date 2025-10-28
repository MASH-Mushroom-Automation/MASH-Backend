import { IsNotEmpty, IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AutocompleteDto {
  @ApiProperty({
    description: 'Search query for autocomplete',
    example: 'shii',
    minLength: 2,
  })
  @IsNotEmpty()
  @IsString()
  q: string;

  @ApiPropertyOptional({
    description: 'Maximum number of suggestions',
    minimum: 1,
    maximum: 20,
    default: 10,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}
