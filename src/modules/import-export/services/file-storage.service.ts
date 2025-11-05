import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

/**
 * File Storage Service
 * Handles file upload, download, and deletion for import/export operations
 *
 * Currently uses local filesystem storage
 * TODO: Implement S3/MinIO integration for production
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    // For now, use local filesystem storage
    // In production, this should be replaced with S3/MinIO
    this.uploadDir = this.configService.get('UPLOAD_DIR', './uploads/import-export');
    // Use BACKEND_URL environment variable with fallback
    this.baseUrl = this.configService.get('BACKEND_URL') || this.configService.get('BASE_URL', 'http://localhost:3000');

    // Ensure upload directory exists
    this.ensureUploadDir();
  }

  /**
   * Ensure the upload directory exists
   */
  private async ensureUploadDir(): Promise<void> {
    try {
      await mkdir(this.uploadDir, { recursive: true });
      this.logger.log(`Upload directory ensured: ${this.uploadDir}`);
    } catch (error) {
      this.logger.error(`Failed to create upload directory: ${error.message}`);
    }
  }

  /**
   * Upload a file and return its URL
   * @param file - The file to upload (from multer)
   * @param folder - Optional subfolder (e.g., 'imports', 'exports')
   * @returns The file URL
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'temp',
  ): Promise<{ url: string; key: string }> {
    try {
      const timestamp = Date.now();
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `${folder}/${timestamp}-${sanitizedFilename}`;
      const filePath = path.join(this.uploadDir, key);

      // Ensure subfolder exists
      const dir = path.dirname(filePath);
      await mkdir(dir, { recursive: true });

      // Write file to disk
      await writeFile(filePath, file.buffer);

      const url = `${this.baseUrl}/api/v1/files/${key}`;

      this.logger.log(`File uploaded: ${key} (${file.size} bytes)`);

      return { url, key };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`);
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  /**
   * Download a file by its key
   * @param key - The file key (path)
   * @returns The file buffer
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const filePath = path.join(this.uploadDir, key);
      const buffer = await readFile(filePath);

      this.logger.log(`File downloaded: ${key}`);

      return buffer;
    } catch (error) {
      this.logger.error(`Failed to download file: ${error.message}`);
      throw new Error(`File download failed: ${error.message}`);
    }
  }

  /**
   * Delete a file by its key
   * @param key - The file key (path)
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadDir, key);
      await unlink(filePath);

      this.logger.log(`File deleted: ${key}`);
    } catch (error) {
      // Don't throw error if file doesn't exist
      if (error.code !== 'ENOENT') {
        this.logger.error(`Failed to delete file: ${error.message}`);
      }
    }
  }

  /**
   * Generate a signed URL for file download (for S3/MinIO)
   * Currently returns the direct URL
   * TODO: Implement signed URL generation for S3/MinIO
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // For local filesystem, just return the direct URL
    return `${this.baseUrl}/api/v1/files/${key}`;
  }

  /**
   * Get file size by key
   */
  async getFileSize(key: string): Promise<number> {
    try {
      const filePath = path.join(this.uploadDir, key);
      const stats = await promisify(fs.stat)(filePath);
      return stats.size;
    } catch (error) {
      this.logger.error(`Failed to get file size: ${error.message}`);
      throw new Error(`Failed to get file size: ${error.message}`);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.uploadDir, key);
      await promisify(fs.access)(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
