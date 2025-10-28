import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isValidDeviceId', async: false })
export class IsValidDeviceIdConstraint implements ValidatorConstraintInterface {
  validate(deviceId: string, args: ValidationArguments): boolean {
    if (!deviceId || typeof deviceId !== 'string') {
      return false;
    }

    // Accept three formats:
    // 1. UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    // 2. MAC Address: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
    // 3. Custom MASH format: MASH-DEV-XXXXX (alphanumeric)

    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const macAddressRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    const mashDeviceIdRegex = /^MASH-DEV-[A-Z0-9]{5,10}$/i;

    return (
      uuidV4Regex.test(deviceId) ||
      macAddressRegex.test(deviceId) ||
      mashDeviceIdRegex.test(deviceId)
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return 'Device ID must be a valid UUID v4, MAC address (XX:XX:XX:XX:XX:XX), or MASH format (MASH-DEV-XXXXX)';
  }
}

/**
 * Validates IoT device identifiers
 * Accepts: UUID v4, MAC address, or custom MASH device ID format
 *
 * @example
 * ```typescript
 * class CreateDeviceDto {
 *   @IsValidDeviceId()
 *   deviceId: string;
 * }
 * ```
 */
export function IsValidDeviceId(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: IsValidDeviceIdConstraint,
    });
  };
}
