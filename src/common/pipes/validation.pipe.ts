import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';

/**
 * Enhanced Validation Pipe
 *
 * Extends NestJS ValidationPipe with custom error formatting
 * Features:
 * - Automatic DTO validation with class-validator
 * - Detailed error messages
 * - Transform plain objects to class instances
 * - Whitelist unknown properties
 * - Strip non-whitelisted properties
 */
@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  async transform(value: any, metadata: ArgumentMetadata) {
    // Skip validation if no metatype or if it's a native type
    if (!metadata.metatype || !this.toValidate(metadata.metatype)) {
      return value;
    }

    // Transform plain object to class instance
    const object = plainToClass(metadata.metatype, value);

    // Validate the object
    const errors = await validate(object, {
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert types automatically
      },
    });

    if (errors.length > 0) {
      throw new BadRequestException(this.formatErrors(errors));
    }

    return object;
  }

  /**
   * Check if metatype should be validated
   */
  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  /**
   * Format validation errors into structured format
   */
  private formatErrors(errors: ValidationError[]): any {
    const formattedErrors: any = {};

    errors.forEach((error) => {
      formattedErrors[error.property] = {
        value: error.value,
        constraints: error.constraints || {},
        messages: error.constraints ? Object.values(error.constraints) : [],
      };

      // Handle nested validation errors
      if (error.children && error.children.length > 0) {
        formattedErrors[error.property].children = this.formatErrors(
          error.children,
        );
      }
    });

    return {
      message: 'Validation failed',
      errors: formattedErrors,
    };
  }
}
