import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ImageProcessorService } from './image-processor.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';

@Injectable()
export class AvatarService {
  private readonly UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'avatars');

  constructor(
    private readonly prisma: PrismaService,
    private readonly imageProcessor: ImageProcessorService,
  ) {
    // Ensure upload directory exists
    this.ensureUploadDir();
  }

  /**
   * Ensure upload directory exists
   */
  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.mkdir(this.UPLOAD_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create upload directory:', error);
    }
  }

  /**
   * Upload avatar for user
   */
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    // Validate image
    await this.imageProcessor.validateImage(file);

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Delete old avatar if exists
    if (user.imageUrl) {
      await this.deleteAvatarFile(user.imageUrl);
    }

    // Process image (resize, convert to WebP, compress)
    const processedBuffer = await this.imageProcessor.processAvatar(
      file.buffer,
    );

    // Generate unique filename
    const filename = this.generateFilename(userId);
    const filePath = path.join(this.UPLOAD_DIR, filename);

    // Save processed image to disk
    await fs.writeFile(filePath, processedBuffer);

    // Generate public URL (for development, use relative path)
    const imageUrl = `/uploads/avatars/${filename}`;

    // Update user's imageUrl in database
    await this.prisma.user.update({
      where: { id: userId },
      data: { imageUrl },
    });

    return imageUrl;
  }

  /**
   * Delete avatar for user
   */
  async deleteAvatar(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { imageUrl: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!user.imageUrl) {
      throw new BadRequestException('User does not have an avatar');
    }

    // Delete avatar file
    await this.deleteAvatarFile(user.imageUrl);

    // Update user's imageUrl to null
    await this.prisma.user.update({
      where: { id: userId },
      data: { imageUrl: null },
    });
  }

  /**
   * Delete avatar file from disk
   */
  private async deleteAvatarFile(imageUrl: string): Promise<void> {
    try {
      // Extract filename from URL
      const filename = path.basename(imageUrl);
      const filePath = path.join(this.UPLOAD_DIR, filename);

      // Check if file exists
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
      } catch (error) {
        // File doesn't exist, ignore
        console.warn(`Avatar file not found: ${filePath}`);
      }
    } catch (error) {
      console.error('Error deleting avatar file:', error);
    }
  }

  /**
   * Generate unique filename for avatar
   */
  private generateFilename(userId: string): string {
    const timestamp = Date.now();
    const random = randomBytes(8).toString('hex');
    return `${userId}-${timestamp}-${random}.webp`;
  }
}
