import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ExcelExportService {
  private readonly logger = new Logger(ExcelExportService.name);
  private readonly EXPORT_DIR = './uploads/exports';

  constructor() {
    // Ensure export directory exists
    if (!fs.existsSync(this.EXPORT_DIR)) {
      fs.mkdirSync(this.EXPORT_DIR, { recursive: true });
    }
  }

  /**
   * Export data to Excel format with styling
   */
  async exportToExcel(
    data: any[],
    filename: string,
    columns?: string[],
    sheetName: string = 'Report',
  ): Promise<{ filePath: string; fileSize: number }> {
    try {
      if (!data || data.length === 0) {
        throw new Error('No data to export');
      }

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'MASH Analytics';
      workbook.created = new Date();
      workbook.modified = new Date();

      // Add worksheet
      const worksheet = workbook.addWorksheet(sheetName);

      // Determine columns from data if not provided
      const headers = columns || Object.keys(data[0]);

      // Add header row with styling
      const headerRow = worksheet.addRow(
        headers.map((col) => this.formatColumnName(col)),
      );
      headerRow.font = { bold: true, size: 12 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }, // Blue background
      };
      headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true }; // White text
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Add data rows
      data.forEach((row) => {
        const values = headers.map((col) => {
          const value = row[col];

          // Format dates
          if (value instanceof Date) {
            return value.toISOString();
          }

          // Format numbers
          if (typeof value === 'number') {
            return value;
          }

          return value;
        });
        worksheet.addRow(values);
      });

      // Auto-fit columns
      worksheet.columns.forEach((column, index) => {
        if (!column) return;
        let maxLength = 0;
        column?.eachCell?.({ includeEmpty: false }, (cell) => {
          const cellValue = cell.value?.toString() || '';
          maxLength = Math.max(maxLength, cellValue.length);
        });
        column.width = Math.min(Math.max(maxLength + 2, 10), 50);
      });

      // Add borders to all cells
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      });

      // Add summary row
      const summaryRow = worksheet.addRow([]);
      summaryRow.getCell(1).value = 'Total Rows:';
      summaryRow.getCell(2).value = data.length;
      summaryRow.font = { bold: true };

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const excelFilename = `${filename}-${timestamp}.xlsx`;
      const filePath = path.join(this.EXPORT_DIR, excelFilename);

      // Write to file
      await workbook.xlsx.writeFile(filePath);

      // Get file size
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      this.logger.log(
        `Excel export completed: ${excelFilename} (${fileSize} bytes, ${data.length} rows)`,
      );

      return {
        filePath: `/exports/${excelFilename}`,
        fileSize,
      };
    } catch (error) {
      this.logger.error(`Excel export failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Export multiple sheets to Excel
   */
  async exportMultiSheet(
    sheets: Array<{ name: string; data: any[]; columns?: string[] }>,
    filename: string,
  ): Promise<{ filePath: string; fileSize: number }> {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'MASH Analytics';

      // Add each sheet
      for (const sheet of sheets) {
        const worksheet = workbook.addWorksheet(sheet.name);
        const headers = sheet.columns || Object.keys(sheet.data[0] || {});

        // Add header
        const headerRow = worksheet.addRow(
          headers.map((col) => this.formatColumnName(col)),
        );
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4472C4' },
        };

        // Add data
        sheet.data.forEach((row) => {
          const values = headers.map((col) => row[col]);
          worksheet.addRow(values);
        });

        // Auto-fit columns
        worksheet.columns.forEach((column) => {
          if (!column) return;
          let maxLength = 0;
          column?.eachCell?.({ includeEmpty: false }, (cell) => {
            const cellValue = cell.value?.toString() || '';
            maxLength = Math.max(maxLength, cellValue.length);
          });
          column.width = Math.min(Math.max(maxLength + 2, 10), 50);
        });
      }

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const excelFilename = `${filename}-${timestamp}.xlsx`;
      const filePath = path.join(this.EXPORT_DIR, excelFilename);

      // Write to file
      await workbook.xlsx.writeFile(filePath);

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      this.logger.log(`Multi-sheet Excel export completed: ${excelFilename}`);

      return {
        filePath: `/exports/${excelFilename}`,
        fileSize,
      };
    } catch (error) {
      this.logger.error(`Multi-sheet export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Format column names
   */
  private formatColumnName(columnName: string): string {
    return columnName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
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
        this.logger.log(`Deleted Excel export: ${filename}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete export: ${error.message}`);
      throw error;
    }
  }
}
