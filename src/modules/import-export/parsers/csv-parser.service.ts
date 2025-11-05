import { Injectable, Logger } from '@nestjs/common';
import * as Papa from 'papaparse';
import { Readable } from 'stream';
import * as fs from 'fs';

export interface CsvParseOptions {
  delimiter?: string; // Default: ','
  skipEmptyLines?: boolean; // Default: true
  header?: boolean; // Default: true
  dynamicTyping?: boolean; // Default: false
  transformHeader?: (header: string) => string;
}

export interface ParsedData {
  data: any[];
  errors: any[];
  meta: {
    delimiter: string;
    linebreak: string;
    fields: string[];
    truncated: boolean;
    aborted: boolean;
  };
}

@Injectable()
export class CsvParserService {
  private readonly logger = new Logger(CsvParserService.name);

  /**
   * Parse CSV file from buffer
   * @param fileBuffer Buffer containing CSV data
   * @param options Parsing options
   * @returns Parsed data with metadata and errors
   */
  async parse(fileBuffer: Buffer, options: CsvParseOptions = {}): Promise<ParsedData> {
    this.logger.log('Parsing CSV file from buffer');

    return new Promise((resolve, reject) => {
      Papa.parse(fileBuffer.toString('utf-8'), {
        header: options.header !== false, // Default: true
        delimiter: options.delimiter || ',',
        skipEmptyLines: options.skipEmptyLines !== false, // Default: true
        dynamicTyping: options.dynamicTyping || false,
        transformHeader: options.transformHeader || (header => header.trim()),
        complete: results => {
          this.logger.log(
            `CSV parsing complete: ${results.data.length} rows, ${results.errors.length} errors`,
          );

          resolve({
            data: results.data,
            errors: results.errors,
            meta: results.meta as any,
          });
        },
        error: error => {
          this.logger.error('CSV parsing failed', error);
          reject(new Error(`CSV parsing failed: ${error.message}`));
        },
      });
    });
  }

  /**
   * Parse CSV file from path with streaming support (for large files)
   * @param filePath Path to CSV file
   * @param options Parsing options
   * @param onData Callback for each parsed row
   * @returns Promise that resolves when parsing is complete
   */
  async parseStream(
    filePath: string,
    options: CsvParseOptions = {},
    onData: (row: any, index: number) => Promise<void>,
  ): Promise<{ totalRows: number; errors: any[] }> {
    this.logger.log(`Streaming CSV file: ${filePath}`);

    return new Promise((resolve, reject) => {
      const errors: any[] = [];
      let rowCount = 0;

      const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });

      Papa.parse(fileStream, {
        header: options.header !== false,
        delimiter: options.delimiter || ',',
        skipEmptyLines: options.skipEmptyLines !== false,
        dynamicTyping: options.dynamicTyping || false,
        transformHeader: options.transformHeader || (header => header.trim()),
        step: async (results, parser) => {
          try {
            // Pause parsing while processing
            parser.pause();

            // Process row
            await onData(results.data, rowCount);
            rowCount++;

            // Resume parsing
            parser.resume();
          } catch (error) {
            this.logger.error(`Error processing row ${rowCount}`, error);
            errors.push({
              row: rowCount,
              error: error.message,
              data: results.data,
            });
          }
        },
        error: error => {
          this.logger.error('CSV streaming failed', error);
          reject(new Error(`CSV streaming failed: ${error.message}`));
        },
        complete: () => {
          this.logger.log(`CSV streaming complete: ${rowCount} rows, ${errors.length} errors`);
          resolve({ totalRows: rowCount, errors });
        },
      });
    });
  }

  /**
   * Generate CSV from data array
   * @param data Array of objects to convert to CSV
   * @param options Generation options
   * @returns CSV string
   */
  generate(
    data: any[],
    options: {
      delimiter?: string;
      header?: boolean;
      columns?: string[];
    } = {},
  ): string {
    this.logger.log(`Generating CSV from ${data.length} rows`);

    const csv = Papa.unparse(data, {
      delimiter: options.delimiter || ',',
      header: options.header !== false,
      columns: options.columns,
    });

    return csv;
  }

  /**
   * Validate CSV structure
   * @param fileBuffer Buffer containing CSV data
   * @param requiredColumns Expected column names
   * @returns Validation result with errors
   */
  async validate(
    fileBuffer: Buffer,
    requiredColumns: string[],
  ): Promise<{ valid: boolean; errors: string[]; foundColumns: string[] }> {
    const errors: string[] = [];

    try {
      const parsed = await this.parse(fileBuffer, { header: true });

      if (!parsed.meta.fields || parsed.meta.fields.length === 0) {
        errors.push('CSV file has no header row');
        return { valid: false, errors, foundColumns: [] };
      }

      const foundColumns = parsed.meta.fields;
      const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));

      if (missingColumns.length > 0) {
        errors.push(
          `Missing required columns: ${missingColumns.join(', ')}. Found columns: ${foundColumns.join(', ')}`,
        );
      }

      if (parsed.data.length === 0) {
        errors.push('CSV file contains no data rows');
      }

      return {
        valid: errors.length === 0,
        errors,
        foundColumns,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`CSV validation failed: ${error.message}`],
        foundColumns: [],
      };
    }
  }

  /**
   * Get CSV preview (first N rows)
   * @param fileBuffer Buffer containing CSV data
   * @param rowCount Number of rows to preview
   * @returns Preview data
   */
  async preview(
    fileBuffer: Buffer,
    rowCount: number = 10,
  ): Promise<{ data: any[]; columns: string[]; totalRows: number }> {
    const parsed = await this.parse(fileBuffer, { header: true });

    return {
      data: parsed.data.slice(0, rowCount),
      columns: parsed.meta.fields || [],
      totalRows: parsed.data.length,
    };
  }
}
