import { Injectable, Logger } from '@nestjs/common';
import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CsvExportService {
  private readonly logger = new Logger(CsvExportService.name);
  private readonly EXPORT_DIR = './uploads/exports';

  constructor() {
    // Ensure export directory exists
    if (!fs.existsSync(this.EXPORT_DIR)) {
      fs.mkdirSync(this.EXPORT_DIR, { recursive: true });
    }
  }

  /**
   * Export data to CSV format
   */
  async exportToCSV(
    data: any[],
    filename: string,
    columns?: string[],
  ): Promise<{ filePath: string; fileSize: number }> {
    try {
      if (!data || data.length === 0) {
        throw new Error('No data to export');
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const csvFilename = `${filename}-${timestamp}.csv`;
      const filePath = path.join(this.EXPORT_DIR, csvFilename);

      // Determine columns from data if not provided
      const headers = columns || Object.keys(data[0]);

      // Create CSV writer
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: headers.map((col) => ({
          id: col,
          title: this.formatColumnName(col),
        })),
      });

      // Write data to CSV
      await csvWriter.writeRecords(data);

      // Get file size
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      this.logger.log(
        `CSV export completed: ${csvFilename} (${fileSize} bytes, ${data.length} rows)`,
      );

      return {
        filePath: `/exports/${csvFilename}`,
        fileSize,
      };
    } catch (error) {
      this.logger.error(`CSV export failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Format column names for CSV headers
   */
  private formatColumnName(columnName: string): string {
    return columnName
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
      .trim();
  }

  /**
   * Delete export file
   */
  async deleteExport(filename: string): Promise<void> {
    try {
      const filePath = path.join(this.EXPORT_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`Deleted export file: ${filename}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete export: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean up old exports (older than 7 days)
   */
  async cleanupOldExports(): Promise<void> {
    try {
      const files = fs.readdirSync(this.EXPORT_DIR);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

      for (const file of files) {
        if (!file.endsWith('.csv')) continue;

        const filePath = path.join(this.EXPORT_DIR, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          fs.unlinkSync(filePath);
          this.logger.log(`Cleaned up old CSV export: ${file}`);
        }
      }
    } catch (error) {
      this.logger.error(`Cleanup failed: ${error.message}`);
    }
  }
}
