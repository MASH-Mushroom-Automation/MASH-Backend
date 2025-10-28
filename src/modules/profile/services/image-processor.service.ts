import { Injectable, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

@Injectable()
export class ImageProcessorService {
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly AVATAR_SIZE = 256;
  private readonly QUALITY = 85;

  /**
   * Process avatar image: resize, convert to WebP, and compress
   */
  async processAvatar(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .resize(this.AVATAR_SIZE, this.AVATAR_SIZE, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: this.QUALITY })
        .toBuffer();
    } catch (error) {
      throw new BadRequestException('Failed to process image');
    }
  }

  /**
   * Validate uploaded image file
   */
  validateImage(file: Express.Multer.File): void {
    // Check if file exists
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // Check MIME type
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Validate image dimensions (optional, but good practice)
    this.validateImageDimensions(file.buffer);
  }

  /**
   * Validate image dimensions using sharp
   */
  private async validateImageDimensions(buffer: Buffer): Promise<void> {
    try {
      const metadata = await sharp(buffer).metadata();

      if (!metadata.width || !metadata.height) {
        throw new BadRequestException('Invalid image file');
      }

      // Optional: Set maximum dimensions
      const MAX_DIMENSION = 4096;
      if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
        throw new BadRequestException(
          `Image dimensions exceed maximum allowed size of ${MAX_DIMENSION}x${MAX_DIMENSION}`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid or corrupted image file');
    }
  }

  /**
   * Get file extension from MIME type
   */
  getFileExtension(mimetype: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    return mimeMap[mimetype] || 'jpg';
  }
}
