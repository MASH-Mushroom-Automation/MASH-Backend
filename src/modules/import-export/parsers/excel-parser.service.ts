import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

export interface ExcelParseOptions {
  sheetName?: string; // Specific sheet name to parse (default: first sheet)
  sheetIndex?: number; // Specific sheet index (0-based, default: 0)
  header?: number; // Header row index (0-based, default: 0)
  range?: string; // Cell range to parse (e.g., 'A1:D10')
  raw?: boolean; // Keep raw values (default: false)
  dateNF?: string; // Date format (default: 'yyyy-mm-dd')
}

export interface ExcelParsedData {
  data: any[];
  sheetName: string;
  sheetNames: string[];
  rowCount: number;
  columnCount: number;
  columns: string[];
}

@Injectable()
export class ExcelParserService {
  private readonly logger = new Logger(ExcelParserService.name);

  /**
   * Parse Excel file from buffer
   * @param fileBuffer Buffer containing Excel data
   * @param options Parsing options
   * @returns Parsed data with metadata
   */
  parse(fileBuffer: Buffer, options: ExcelParseOptions = {}): ExcelParsedData {
    this.logger.log('Parsing Excel file from buffer');

    try {
      // Read workbook from buffer
      const workbook = XLSX.read(fileBuffer, {
        type: 'buffer',
        cellDates: true,
        dateNF: options.dateNF || 'yyyy-mm-dd',
      });

      // Get sheet name
      const sheetName =
        options.sheetName || workbook.SheetNames[options.sheetIndex || 0] || workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error('No sheets found in Excel file');
      }

      // Get worksheet
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error(`Sheet "${sheetName}" not found`);
      }

      // Parse sheet to JSON
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: options.header,
        range: options.range,
        raw: options.raw || false,
        dateNF: options.dateNF || 'yyyy-mm-dd',
        defval: null, // Default value for empty cells
      });

      // Get columns from first row
      const columns = data.length > 0 ? Object.keys(data[0] as object) : [];

      // Get sheet dimensions
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const rowCount = range.e.r - range.s.r + 1;
      const columnCount = range.e.c - range.s.c + 1;

      this.logger.log(`Excel parsing complete: ${data.length} rows from sheet "${sheetName}"`);

      return {
        data,
        sheetName,
        sheetNames: workbook.SheetNames,
        rowCount: data.length,
        columnCount,
        columns,
      };
    } catch (error) {
      this.logger.error('Excel parsing failed', error);
      throw new Error(`Excel parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse Excel file from path with streaming support (for large files)
   * @param filePath Path to Excel file
   * @param options Parsing options
   * @param onData Callback for each parsed row
   * @returns Promise with parsing summary
   */
  async parseStream(
    filePath: string,
    options: ExcelParseOptions = {},
    onData: (row: any, index: number) => Promise<void>,
  ): Promise<{ totalRows: number; errors: any[] }> {
    this.logger.log(`Streaming Excel file: ${filePath}`);

    const errors: any[] = [];
    let rowCount = 0;

    try {
      // Read file as buffer
      const fileBuffer = fs.readFileSync(filePath);

      // Parse workbook
      const workbook = XLSX.read(fileBuffer, {
        type: 'buffer',
        cellDates: true,
        dateNF: options.dateNF || 'yyyy-mm-dd',
      });

      // Get sheet
      const sheetName =
        options.sheetName || workbook.SheetNames[options.sheetIndex || 0] || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON with streaming
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: options.header,
        range: options.range,
        raw: options.raw || false,
        dateNF: options.dateNF || 'yyyy-mm-dd',
        defval: null,
      });

      // Process rows
      for (let i = 0; i < data.length; i++) {
        try {
          await onData(data[i], i);
          rowCount++;
        } catch (error) {
          this.logger.error(`Error processing row ${i}`, error);
          errors.push({
            row: i,
            error: error.message,
            data: data[i],
          });
        }
      }

      this.logger.log(`Excel streaming complete: ${rowCount} rows, ${errors.length} errors`);

      return { totalRows: rowCount, errors };
    } catch (error) {
      this.logger.error('Excel streaming failed', error);
      throw new Error(`Excel streaming failed: ${error.message}`);
    }
  }

  /**
   * Generate Excel file from data array
   * @param data Array of objects to convert to Excel
   * @param options Generation options
   * @returns Excel buffer
   */
  generate(
    data: any[],
    options: {
      sheetName?: string;
      columns?: string[];
      dateNF?: string;
    } = {},
  ): Buffer {
    this.logger.log(`Generating Excel from ${data.length} rows`);

    try {
      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Create worksheet from data
      const worksheet = XLSX.utils.json_to_sheet(data, {
        header: options.columns,
        dateNF: options.dateNF || 'yyyy-mm-dd',
      });

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName || 'Sheet1');

      // Write to buffer
      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      });

      return buffer as Buffer;
    } catch (error) {
      this.logger.error('Excel generation failed', error);
      throw new Error(`Excel generation failed: ${error.message}`);
    }
  }

  /**
   * List all sheets in Excel file
   * @param fileBuffer Buffer containing Excel data
   * @returns Array of sheet names with row counts
   */
  listSheets(fileBuffer: Buffer): { name: string; rowCount: number }[] {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

      return workbook.SheetNames.map(name => {
        const worksheet = workbook.Sheets[name];
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const rowCount = range.e.r - range.s.r + 1;

        return { name, rowCount };
      });
    } catch (error) {
      this.logger.error('Failed to list sheets', error);
      throw new Error(`Failed to list sheets: ${error.message}`);
    }
  }

  /**
   * Validate Excel structure
   * @param fileBuffer Buffer containing Excel data
   * @param requiredColumns Expected column names
   * @param options Parsing options
   * @returns Validation result
   */
  validate(
    fileBuffer: Buffer,
    requiredColumns: string[],
    options: ExcelParseOptions = {},
  ): { valid: boolean; errors: string[]; foundColumns: string[] } {
    const errors: string[] = [];

    try {
      const parsed = this.parse(fileBuffer, options);

      if (parsed.columns.length === 0) {
        errors.push('Excel file has no columns');
        return { valid: false, errors, foundColumns: [] };
      }

      const foundColumns = parsed.columns;
      const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));

      if (missingColumns.length > 0) {
        errors.push(
          `Missing required columns: ${missingColumns.join(', ')}. Found columns: ${foundColumns.join(', ')}`,
        );
      }

      if (parsed.data.length === 0) {
        errors.push('Excel file contains no data rows');
      }

      return {
        valid: errors.length === 0,
        errors,
        foundColumns,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Excel validation failed: ${error.message}`],
        foundColumns: [],
      };
    }
  }

  /**
   * Get Excel preview (first N rows)
   * @param fileBuffer Buffer containing Excel data
   * @param rowCount Number of rows to preview
   * @param options Parsing options
   * @returns Preview data
   */
  preview(
    fileBuffer: Buffer,
    rowCount: number = 10,
    options: ExcelParseOptions = {},
  ): { data: any[]; columns: string[]; totalRows: number; sheets: string[] } {
    const parsed = this.parse(fileBuffer, options);

    return {
      data: parsed.data.slice(0, rowCount),
      columns: parsed.columns,
      totalRows: parsed.rowCount,
      sheets: parsed.sheetNames,
    };
  }
}
