import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfExportService {
  private readonly logger = new Logger(PdfExportService.name);
  private readonly EXPORT_DIR = './uploads/exports';

  constructor() {
    // Ensure export directory exists
    if (!fs.existsSync(this.EXPORT_DIR)) {
      fs.mkdirSync(this.EXPORT_DIR, { recursive: true });
    }
  }

  /**
   * Export data to PDF format
   */
  async exportToPDF(
    data: any[],
    filename: string,
    options: {
      title?: string;
      columns?: string[];
      includeCharts?: boolean;
    } = {},
  ): Promise<{ filePath: string; fileSize: number }> {
    try {
      if (!data || data.length === 0) {
        throw new Error('No data to export');
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const pdfFilename = `${filename}-${timestamp}.pdf`;
      const filePath = path.join(this.EXPORT_DIR, pdfFilename);

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Add title
      const title = options.title || 'Analytics Report';
      doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.moveDown();

      // Add metadata
      doc.fontSize(10).font('Helvetica');
      doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'right' });
      doc.text(`Total Records: ${data.length}`, { align: 'right' });
      doc.moveDown();

      // Determine columns
      const headers = options.columns || Object.keys(data[0]);

      // Add table headers
      const tableTop = doc.y;
      const columnWidth = (doc.page.width - 100) / headers.length;
      let currentX = 50;

      doc.fontSize(10).font('Helvetica-Bold');
      headers.forEach(header => {
        doc.text(this.formatColumnName(header), currentX, tableTop, {
          width: columnWidth,
          align: 'left',
        });
        currentX += columnWidth;
      });

      doc.moveDown();
      doc
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();
      doc.moveDown();

      // Add table rows
      doc.fontSize(9).font('Helvetica');
      const maxRows = 50; // Limit to prevent huge PDFs

      data.slice(0, maxRows).forEach((row, index) => {
        currentX = 50;
        const rowY = doc.y;

        headers.forEach(header => {
          let value = row[header];

          // Format value
          if (value instanceof Date) {
            value = value.toLocaleDateString();
          } else if (typeof value === 'number') {
            value = value.toLocaleString();
          } else if (value === null || value === undefined) {
            value = '-';
          }

          doc.text(String(value), currentX, rowY, {
            width: columnWidth,
            align: 'left',
          });
          currentX += columnWidth;
        });

        doc.moveDown(0.5);

        // Add page break if needed
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
        }
      });

      // Add footer
      doc.moveDown(2);
      if (data.length > maxRows) {
        doc
          .fontSize(8)
          .font('Helvetica-Oblique')
          .text(
            `Note: Showing first ${maxRows} of ${data.length} records`,
            50,
            doc.page.height - 50,
            { align: 'center' },
          );
      }

      // Finalize PDF
      doc.end();

      // Wait for write to complete
      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      // Get file size
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      this.logger.log(
        `PDF export completed: ${pdfFilename} (${fileSize} bytes, ${Math.min(data.length, maxRows)} rows)`,
      );

      return {
        filePath: `/exports/${pdfFilename}`,
        fileSize,
      };
    } catch (error) {
      this.logger.error(`PDF export failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Format column names
   */
  private formatColumnName(columnName: string): string {
    return columnName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
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
        this.logger.log(`Deleted PDF export: ${filename}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete export: ${error.message}`);
      throw error;
    }
  }
}
