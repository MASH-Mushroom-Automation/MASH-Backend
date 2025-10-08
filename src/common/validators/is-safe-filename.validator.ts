import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Allowed file extensions (whitelist)
 */
const ALLOWED_EXTENSIONS = [
  // Images
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
  // Documents
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  // Archives
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  // Code
  '.json',
  '.xml',
  '.yaml',
  '.yml',
  '.md',
];

/**
 * Dangerous patterns that should never appear in filenames
 */
const DANGEROUS_PATTERNS = [
  /\.\./, // Directory traversal (..)
  /[<>:"|?*]/, // Windows reserved characters
  /\0/, // Null byte
  /[\x00-\x1f]/, // Control characters
  /^\./, // Hidden files (starting with .)
  /\.exe$/i, // Executable files
  /\.bat$/i,
  /\.cmd$/i,
  /\.sh$/i,
  /\.php$/i, // Script files
  /\.jsp$/i,
  /\.asp$/i,
  /\.aspx$/i,
];

@ValidatorConstraint({ name: 'isSafeFilename', async: false })
export class IsSafeFilenameConstraint implements ValidatorConstraintInterface {
  validate(filename: string, args: ValidationArguments): boolean {
    if (!filename || typeof filename !== 'string') {
      return false;
    }

    // Check length
    if (filename.length > 255) {
      return false;
    }

    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(filename)) {
        return false;
      }
    }

    // Check if file has an extension
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) {
      return false; // No extension
    }

    // Extract extension
    const extension = filename.substring(lastDot).toLowerCase();

    // Check if extension is in whitelist
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return false;
    }

    // Check for valid characters (alphanumeric, dash, underscore, dot)
    const validCharsRegex = /^[a-zA-Z0-9_\-\.]+$/;
    if (!validCharsRegex.test(filename)) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    return `Filename must be safe (max 255 chars, allowed extensions: ${ALLOWED_EXTENSIONS.slice(0, 10).join(', ')}..., no special characters)`;
  }
}

/**
 * Validates that a filename is safe from directory traversal and XSS attacks
 * Enforces whitelist of allowed extensions and character restrictions
 *
 * @example
 * ```typescript
 * class UploadFileDto {
 *   @IsSafeFilename()
 *   filename: string;
 * }
 * ```
 */
export function IsSafeFilename(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: IsSafeFilenameConstraint,
    });
  };
}
