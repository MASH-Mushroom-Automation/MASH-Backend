import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Valid Philippine mobile network prefixes
 * Updated as of 2025 - includes Smart, Globe, Sun, DITO, TNT, TM
 */
const PH_MOBILE_PREFIXES = [
  '0813',
  '0817',
  '0905',
  '0906',
  '0907',
  '0908',
  '0909',
  '0910',
  '0911',
  '0912',
  '0913',
  '0914',
  '0915',
  '0916',
  '0917',
  '0918',
  '0919',
  '0920',
  '0921',
  '0922',
  '0923',
  '0924',
  '0925',
  '0926',
  '0927',
  '0928',
  '0929',
  '0930',
  '0931',
  '0932',
  '0933',
  '0934',
  '0935',
  '0936',
  '0937',
  '0938',
  '0939',
  '0940',
  '0941',
  '0942',
  '0943',
  '0944',
  '0945',
  '0946',
  '0947',
  '0948',
  '0949',
  '0950',
  '0951',
  '0952',
  '0953',
  '0954',
  '0955',
  '0956',
  '0957',
  '0958',
  '0959',
  '0960',
  '0961',
  '0962',
  '0963',
  '0964',
  '0965',
  '0966',
  '0967',
  '0968',
  '0969',
  '0970',
  '0971',
  '0972',
  '0973',
  '0974',
  '0975',
  '0976',
  '0977',
  '0978',
  '0979',
  '0980',
  '0981',
  '0982',
  '0983',
  '0984',
  '0985',
  '0986',
  '0987',
  '0988',
  '0989',
  '0990',
  '0991',
  '0992',
  '0993',
  '0994',
  '0995',
  '0996',
  '0997',
  '0998',
  '0999',
];

@ValidatorConstraint({ name: 'isValidPhone', async: false })
export class IsValidPhoneConstraint implements ValidatorConstraintInterface {
  validate(phone: string, args: ValidationArguments): boolean {
    if (!phone || typeof phone !== 'string') {
      return false;
    }

    // Remove all spaces, dashes, and parentheses
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');

    // Check format: 09XXXXXXXXX (11 digits) or +639XXXXXXXXX (13 chars)
    const localFormat = /^09\d{9}$/;
    const internationalFormat = /^\+639\d{9}$/;

    if (!localFormat.test(cleaned) && !internationalFormat.test(cleaned)) {
      return false;
    }

    // Extract the prefix (first 4 digits for local, skip +63 for international)
    let prefix: string;
    if (cleaned.startsWith('+63')) {
      prefix = '0' + cleaned.substring(3, 6); // Convert +639XX to 09XX
    } else {
      prefix = cleaned.substring(0, 4);
    }

    // Validate against known Philippine mobile prefixes
    return PH_MOBILE_PREFIXES.includes(prefix);
  }

  defaultMessage(args: ValidationArguments): string {
    return 'Phone number must be a valid Philippine mobile number (format: 09XXXXXXXXX or +639XXXXXXXXX)';
  }
}

/**
 * Validates Philippine mobile phone numbers
 * Accepts formats: 09XXXXXXXXX, +639XXXXXXXXX, with optional spaces/dashes
 *
 * @example
 * ```typescript
 * class UpdateProfileDto {
 *   @IsValidPhone()
 *   phoneNumber: string;
 * }
 * ```
 */
export function IsValidPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: IsValidPhoneConstraint,
    });
  };
}
