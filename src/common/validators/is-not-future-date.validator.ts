import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export interface IsNotFutureDateOptions {
  /**
   * Grace period in milliseconds to allow for clock skew
   * Default: 300000 (5 minutes)
   */
  gracePeriodMs?: number;
}

@ValidatorConstraint({ name: 'isNotFutureDate', async: false })
export class IsNotFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: string | Date, args: ValidationArguments): boolean {
    if (!value) {
      return false;
    }

    const options: IsNotFutureDateOptions = args.constraints[0] || {};
    const gracePeriodMs = options.gracePeriodMs ?? 300000; // 5 minutes default

    let date: Date;

    // Parse date
    if (typeof value === 'string') {
      // Validate ISO 8601 format
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value)) {
        return false;
      }
      date = new Date(value);
    } else if (value instanceof Date) {
      date = value;
    } else {
      return false;
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return false;
    }

    // Check if date is in the future (with grace period)
    const now = new Date();
    const maxAllowedDate = new Date(now.getTime() + gracePeriodMs);

    return date <= maxAllowedDate;
  }

  defaultMessage(args: ValidationArguments): string {
    const options: IsNotFutureDateOptions = args.constraints[0] || {};
    const gracePeriodMs = options.gracePeriodMs ?? 300000;
    const gracePeriodMinutes = Math.round(gracePeriodMs / 60000);

    return `Date cannot be in the future (grace period: ${gracePeriodMinutes} minutes for clock skew)`;
  }
}

/**
 * Validates that a date is not in the future
 * Allows a grace period for clock skew between client and server
 * Useful for sensor timestamps and log entries
 *
 * @param options - Configuration options
 * @param options.gracePeriodMs - Grace period in milliseconds (default: 5 minutes)
 *
 * @example
 * ```typescript
 * class IngestSensorDataDto {
 *   @IsNotFutureDate({ gracePeriodMs: 300000 }) // 5 minutes
 *   @IsISO8601()
 *   timestamp: string;
 * }
 * ```
 */
export function IsNotFutureDate(
  options?: IsNotFutureDateOptions,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: IsNotFutureDateConstraint,
    });
  };
}
