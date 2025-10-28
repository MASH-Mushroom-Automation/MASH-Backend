import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { isObjectId } from '../utils/validator.util';

/**
 * Parse ObjectId Pipe
 *
 * Validates and transforms MongoDB ObjectId strings
 * Features:
 * - Validates ObjectId format
 * - Throws BadRequestException for invalid IDs
 * - Can be used with @Param, @Query, @Body
 *
 * Usage:
 * @Get(':id')
 * findOne(@Param('id', ParseObjectIdPipe) id: string) {}
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    // Skip if value is undefined or null
    if (!value) {
      throw new BadRequestException('ObjectId is required');
    }

    // Validate ObjectId format
    if (!isObjectId(value)) {
      throw new BadRequestException(
        `Invalid ObjectId format: ${value}. Expected 24 character hex string.`,
      );
    }

    return value;
  }
}
