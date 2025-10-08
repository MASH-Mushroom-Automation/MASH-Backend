import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Common weak passwords to block (dictionary check)
 * In production, consider using a comprehensive password dictionary
 */
const COMMON_WEAK_PASSWORDS = [
  'password',
  'password123',
  '12345678',
  'qwerty',
  'abc123',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
  'master',
  '123456789',
  'iloveyou',
  'admin',
  'administrator',
  'root',
  'toor',
  'pass',
  'test',
  'guest',
  'info',
];

export interface IsStrongPasswordOptions {
  minLength?: number;
  minLowercase?: number;
  minUppercase?: number;
  minNumbers?: number;
  minSymbols?: number;
  allowSpaces?: boolean;
  blockCommonPasswords?: boolean;
}

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint
  implements ValidatorConstraintInterface
{
  validate(password: string, args: ValidationArguments): boolean {
    if (!password || typeof password !== 'string') {
      return false;
    }

    const options: IsStrongPasswordOptions = args.constraints[0] || {};
    const {
      minLength = 8,
      minLowercase = 1,
      minUppercase = 1,
      minNumbers = 1,
      minSymbols = 1,
      allowSpaces = false,
      blockCommonPasswords = true,
    } = options;

    // Check minimum length
    if (password.length < minLength) {
      return false;
    }

    // Check for spaces if not allowed
    if (!allowSpaces && /\s/.test(password)) {
      return false;
    }

    // Count character types
    const lowercaseCount = (password.match(/[a-z]/g) || []).length;
    const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
    const numberCount = (password.match(/[0-9]/g) || []).length;
    const symbolCount = (password.match(/[^a-zA-Z0-9\s]/g) || []).length;

    // Validate character type requirements
    if (lowercaseCount < minLowercase) {
      return false;
    }
    if (uppercaseCount < minUppercase) {
      return false;
    }
    if (numberCount < minNumbers) {
      return false;
    }
    if (symbolCount < minSymbols) {
      return false;
    }

    // Block common weak passwords
    if (blockCommonPasswords) {
      const lowerPassword = password.toLowerCase();
      if (COMMON_WEAK_PASSWORDS.includes(lowerPassword)) {
        return false;
      }

      // Check if password is just the username (if available in object)
      const object = args.object as any;
      if (
        object.username &&
        lowerPassword.includes(object.username.toLowerCase())
      ) {
        return false;
      }
      if (object.email) {
        const emailUsername = object.email.split('@')[0].toLowerCase();
        if (lowerPassword.includes(emailUsername)) {
          return false;
        }
      }
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const options: IsStrongPasswordOptions = args.constraints[0] || {};
    const {
      minLength = 8,
      minLowercase = 1,
      minUppercase = 1,
      minNumbers = 1,
      minSymbols = 1,
    } = options;

    const requirements: string[] = [];
    requirements.push(`at least ${minLength} characters`);
    if (minLowercase > 0)
      requirements.push(`${minLowercase} lowercase letter(s)`);
    if (minUppercase > 0)
      requirements.push(`${minUppercase} uppercase letter(s)`);
    if (minNumbers > 0) requirements.push(`${minNumbers} number(s)`);
    if (minSymbols > 0) requirements.push(`${minSymbols} special character(s)`);

    return `Password must contain ${requirements.join(', ')}. Avoid common passwords and using your username/email.`;
  }
}

/**
 * Validates that a password meets strong password requirements
 *
 * @example
 * ```typescript
 * class CreateUserDto {
 *   @IsStrongPassword({
 *     minLength: 8,
 *     minLowercase: 1,
 *     minUppercase: 1,
 *     minNumbers: 1,
 *     minSymbols: 1
 *   })
 *   password: string;
 * }
 * ```
 */
export function IsStrongPassword(
  options?: IsStrongPasswordOptions,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: IsStrongPasswordConstraint,
    });
  };
}
