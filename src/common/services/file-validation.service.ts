import { Injectable, BadRequestException } from '@nestjs/common';
import type { File } from 'multer';

/**
 * File Validation Service for Enterprise Security
 * Comprehensive file upload validation to prevent security vulnerabilities
 *
 * Security Features:
 * - MIME type validation (magic number checking)
 * - File extension validation
 * - File size limits
 * - Dangerous file type blocking
 * - Image-specific validation
 * - Document validation
 *
 * Part of Issue #23 - Enterprise Security & Input Validation System
 */
@Injectable()
export class FileValidationService {
  /**
   * Maximum file sizes by category (in bytes)
   */
  private readonly maxFileSizes = {
    image: 10 * 1024 * 1024, // 10 MB
    document: 25 * 1024 * 1024, // 25 MB
    video: 100 * 1024 * 1024, // 100 MB
    audio: 10 * 1024 * 1024, // 10 MB
    default: 5 * 1024 * 1024, // 5 MB
  };

  /**
   * Allowed MIME types by category
   */
  private readonly allowedMimeTypes = {
    image: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
      'image/x-icon',
      'image/vnd.microsoft.icon',
    ],
    document: [
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'text/plain',
      'text/csv',
      'application/json',
      'application/xml',
      'text/xml',
      'text/markdown',
      'application/yaml',
      'text/yaml',
    ],
    archive: [
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/gzip',
      'application/x-gzip',
    ],
    video: [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-ms-wmv',
      'video/webm',
    ],
    audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm'],
  };

  /**
   * Dangerous file extensions that should never be allowed
   */
  private readonly dangerousExtensions = [
    '.exe',
    '.bat',
    '.cmd',
    '.sh',
    '.ps1',
    '.vbs',
    '.js',
    '.jar',
    '.app',
    '.deb',
    '.rpm',
    '.dmg',
    '.pkg',
    '.msi',
    '.com',
    '.scr',
    '.php',
    '.asp',
    '.aspx',
    '.jsp',
    '.cgi',
    '.pl',
    '.py',
    '.rb',
    '.dll',
    '.so',
    '.dylib',
    '.bin',
    '.run',
    '.out',
  ];

  /**
   * MIME type magic numbers for validation
   * Maps MIME types to their file signature (first few bytes in hex)
   */
  private readonly mimeSignatures: Record<string, string[]> = {
    'image/jpeg': ['FFD8FF'],
    'image/png': ['89504E47'],
    'image/gif': ['474946383761', '474946383961'], // GIF87a, GIF89a
    'image/webp': ['52494646'], // RIFF
    'application/pdf': ['25504446'],
    'application/zip': ['504B0304', '504B0506', '504B0708'],
    'image/bmp': ['424D'],
    'video/mp4': ['667479706D703432'], // ftypisom at offset 4
    'audio/mpeg': ['494433'], // ID3
  };

  /**
   * Validate uploaded file
   * Comprehensive validation including MIME type, extension, and size
   *
   * @param file - Uploaded file object (Express.Multer.File)
   * @param options - Validation options
   * @returns true if valid, throws BadRequestException otherwise
   *
   * @example
   * ```typescript
   * try {
   *   await fileValidationService.validateFile(file, {
   *     category: 'image',
   *     maxSize: 5 * 1024 * 1024,
   *   });
   * } catch (error) {
   *   // Handle validation error
   * }
   * ```
   */
  async validateFile(
    file: File,
    options: {
      category?: 'image' | 'document' | 'archive' | 'video' | 'audio';
      maxSize?: number;
      allowedMimeTypes?: string[];
      allowedExtensions?: string[];
    } = {},
  ): Promise<boolean> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // 1. Validate filename is safe
    this.validateFilename(file.originalname);

    // 2. Validate file extension
    this.validateExtension(file.originalname, options.allowedExtensions);

    // 3. Validate file size
    this.validateSize(file.size, options.category, options.maxSize);

    // 4. Validate MIME type
    this.validateMimeType(file.mimetype, options.category, options.allowedMimeTypes);

    // 5. Validate magic numbers (file signature)
    if (file.buffer) {
      await this.validateMagicNumbers(file.buffer, file.mimetype);
    }

    return true;
  }

  /**
   * Validate filename is safe
   * Uses same logic as IsSafeFilename validator
   */
  private validateFilename(filename: string): void {
    // Check for directory traversal
    if (filename.includes('../') || filename.includes('..\\')) {
      throw new BadRequestException('Filename contains directory traversal characters');
    }

    // Check for path separators
    if (filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Filename contains path separators');
    }

    // Check for dangerous characters
    if (/[<>:"|?*\x00-\x1f]/.test(filename)) {
      throw new BadRequestException('Filename contains invalid characters');
    }

    // Check filename length
    if (filename.length > 255) {
      throw new BadRequestException('Filename is too long (max 255 characters)');
    }

    // Check for empty filename
    if (!filename || filename.trim().length === 0) {
      throw new BadRequestException('Filename cannot be empty');
    }
  }

  /**
   * Validate file extension
   * Blocks dangerous extensions and checks against whitelist
   */
  private validateExtension(filename: string, allowedExtensions?: string[]): void {
    const extension = this.getExtension(filename);

    // Check against dangerous extensions
    if (this.dangerousExtensions.includes(extension.toLowerCase())) {
      throw new BadRequestException(
        `File extension '${extension}' is not allowed for security reasons`,
      );
    }

    // Check against whitelist if provided
    if (allowedExtensions && allowedExtensions.length > 0) {
      const normalizedAllowed = allowedExtensions.map(ext =>
        ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`,
      );

      if (!normalizedAllowed.includes(extension.toLowerCase())) {
        throw new BadRequestException(
          `File extension '${extension}' is not allowed. Allowed: ${allowedExtensions.join(', ')}`,
        );
      }
    }
  }

  /**
   * Validate file size
   */
  private validateSize(size: number, category?: string, maxSize?: number): void {
    const limit =
      maxSize ||
      this.maxFileSizes[category as keyof typeof this.maxFileSizes] ||
      this.maxFileSizes.default;

    if (size > limit) {
      const limitMB = (limit / (1024 * 1024)).toFixed(2);
      throw new BadRequestException(
        `File size (${(size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size (${limitMB} MB)`,
      );
    }

    if (size === 0) {
      throw new BadRequestException('File is empty');
    }
  }

  /**
   * Validate MIME type
   */
  private validateMimeType(mimetype: string, category?: string, allowedMimeTypes?: string[]): void {
    // Use provided whitelist if available
    if (allowedMimeTypes && allowedMimeTypes.length > 0) {
      if (!allowedMimeTypes.includes(mimetype)) {
        throw new BadRequestException(
          `MIME type '${mimetype}' is not allowed. Allowed: ${allowedMimeTypes.join(', ')}`,
        );
      }
      return;
    }

    // Use category-based whitelist
    if (category) {
      const allowed = this.allowedMimeTypes[category as keyof typeof this.allowedMimeTypes];
      if (allowed && !allowed.includes(mimetype)) {
        throw new BadRequestException(
          `MIME type '${mimetype}' is not allowed for category '${category}'`,
        );
      }
    }
  }

  /**
   * Validate file magic numbers (file signature)
   * Prevents MIME type spoofing attacks
   */
  private async validateMagicNumbers(buffer: Buffer, expectedMimetype: string): Promise<void> {
    const signatures = this.mimeSignatures[expectedMimetype];
    if (!signatures) {
      // No signature defined for this MIME type, skip validation
      return;
    }

    const fileHeader = buffer.toString('hex', 0, 12).toUpperCase();

    const matches = signatures.some(signature => fileHeader.startsWith(signature.toUpperCase()));

    if (!matches) {
      throw new BadRequestException(
        `File signature does not match declared MIME type '${expectedMimetype}'. Possible file type spoofing.`,
      );
    }
  }

  /**
   * Validate image file specifically
   * Additional checks for image files
   */
  async validateImage(
    file: File,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      maxSize?: number;
    } = {},
  ): Promise<boolean> {
    await this.validateFile(file, {
      category: 'image',
      maxSize: options.maxSize,
      allowedMimeTypes: this.allowedMimeTypes.image,
    });

    // TODO: Add image dimension validation using sharp library
    // if (options.maxWidth || options.maxHeight) {
    //   const metadata = await sharp(file.buffer).metadata();
    //   if (options.maxWidth && metadata.width > options.maxWidth) {
    //     throw new BadRequestException(`Image width exceeds maximum of ${options.maxWidth}px`);
    //   }
    //   if (options.maxHeight && metadata.height > options.maxHeight) {
    //     throw new BadRequestException(`Image height exceeds maximum of ${options.maxHeight}px`);
    //   }
    // }

    return true;
  }

  /**
   * Validate document file specifically
   */
  async validateDocument(
    file: File,
    options: { maxSize?: number } = {},
  ): Promise<boolean> {
    return this.validateFile(file, {
      category: 'document',
      maxSize: options.maxSize,
      allowedMimeTypes: this.allowedMimeTypes.document,
    });
  }

  /**
   * Batch validate multiple files
   */
  async validateFiles(
    files: File[],
    options: Parameters<typeof this.validateFile>[1] = {},
  ): Promise<boolean> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    for (const file of files) {
      await this.validateFile(file, options);
    }

    return true;
  }

  /**
   * Get file extension from filename
   */
  private getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  }

  /**
   * Check if file type is allowed for a specific purpose
   */
  isFileTypeAllowed(
    mimetype: string,
    category: 'image' | 'document' | 'archive' | 'video' | 'audio',
  ): boolean {
    const allowed = this.allowedMimeTypes[category];
    return allowed ? allowed.includes(mimetype) : false;
  }

  /**
   * Get maximum file size for a category
   */
  getMaxFileSize(category: keyof typeof this.maxFileSizes): number {
    return this.maxFileSizes[category] || this.maxFileSizes.default;
  }

  /**
   * Get allowed MIME types for a category
   */
  getAllowedMimeTypes(category: keyof typeof this.allowedMimeTypes): string[] {
    return this.allowedMimeTypes[category] || [];
  }

  /**
   * Format file size in human-readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
