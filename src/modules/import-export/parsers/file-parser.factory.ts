import { Injectable, Logger } from '@nestjs/common';
import { CsvParserService } from './csv-parser.service';
import { ExcelParserService } from './excel-parser.service';
import { JsonParserService } from './json-parser.service';
import { XmlParserService } from './xml-parser.service';

export enum FileFormat {
  CSV = 'CSV',
  EXCEL = 'EXCEL',
  JSON = 'JSON',
  XML = 'XML',
}

export interface IFileParser {
  parse(fileBuffer: Buffer, options?: any): any;
  parseStream(
    filePath: string,
    options: any,
    onData: (row: any, index: number) => Promise<void>,
  ): Promise<{ totalRows: number; errors: any[] }>;
  generate(data: any[], options?: any): any;
  validate(fileBuffer: Buffer, requiredFields: string[]): any;
  preview(fileBuffer: Buffer, count: number): any;
}

@Injectable()
export class FileParserFactory {
  private readonly logger = new Logger(FileParserFactory.name);

  constructor(
    private readonly csvParser: CsvParserService,
    private readonly excelParser: ExcelParserService,
    private readonly jsonParser: JsonParserService,
    private readonly xmlParser: XmlParserService,
  ) {}

  /**
   * Get appropriate parser for file format
   * @param format File format enum
   * @returns Parser instance
   */
  getParser(format: FileFormat): IFileParser {
    this.logger.log(`Getting parser for format: ${format}`);

    switch (format) {
      case FileFormat.CSV:
        return this.csvParser;

      case FileFormat.EXCEL:
        return this.excelParser;

      case FileFormat.JSON:
        return this.jsonParser;

      case FileFormat.XML:
        return this.xmlParser;

      default:
        throw new Error(`Unsupported file format: ${format}`);
    }
  }

  /**
   * Auto-detect file format from extension
   * @param filename File name with extension
   * @returns Detected file format
   */
  detectFormatFromFilename(filename: string): FileFormat {
    const extension = filename.split('.').pop()?.toLowerCase();

    this.logger.log(`Detecting format from filename: ${filename} (extension: ${extension})`);

    switch (extension) {
      case 'csv':
      case 'tsv':
      case 'txt':
        return FileFormat.CSV;

      case 'xlsx':
      case 'xls':
      case 'xlsm':
      case 'xlsb':
        return FileFormat.EXCEL;

      case 'json':
      case 'jsonl':
        return FileFormat.JSON;

      case 'xml':
        return FileFormat.XML;

      default:
        throw new Error(
          `Unable to detect file format from extension: ${extension}. Supported: csv, xlsx, xls, json, xml`,
        );
    }
  }

  /**
   * Auto-detect file format from MIME type
   * @param mimeType MIME type string
   * @returns Detected file format
   */
  detectFormatFromMimeType(mimeType: string): FileFormat {
    this.logger.log(`Detecting format from MIME type: ${mimeType}`);

    switch (mimeType) {
      case 'text/csv':
      case 'text/tab-separated-values':
      case 'text/plain':
        return FileFormat.CSV;

      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
      case 'application/vnd.ms-excel.sheet.macroEnabled.12':
      case 'application/vnd.ms-excel.sheet.binary.macroEnabled.12':
        return FileFormat.EXCEL;

      case 'application/json':
        return FileFormat.JSON;

      case 'application/xml':
      case 'text/xml':
        return FileFormat.XML;

      default:
        throw new Error(
          `Unable to detect file format from MIME type: ${mimeType}`,
        );
    }
  }

  /**
   * Auto-detect file format from file content
   * @param fileBuffer File buffer
   * @returns Detected file format or null
   */
  detectFormatFromContent(fileBuffer: Buffer): FileFormat | null {
    this.logger.log('Detecting format from file content');

    const content = fileBuffer.toString('utf-8', 0, 1000); // Read first 1KB

    // Check for XML (starts with <?xml or <root>)
    if (
      content.trim().startsWith('<?xml') ||
      content.trim().startsWith('<') && content.includes('>')
    ) {
      return FileFormat.XML;
    }

    // Check for JSON (starts with { or [)
    const trimmed = content.trim();
    if (
      (trimmed.startsWith('{') && trimmed.includes('}')) ||
      (trimmed.startsWith('[') && trimmed.includes(']'))
    ) {
      try {
        JSON.parse(trimmed);
        return FileFormat.JSON;
      } catch {
        // Not valid JSON
      }
    }

    // Check for Excel (binary format - starts with PK)
    if (fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4b) {
      return FileFormat.EXCEL;
    }

    // Check for CSV (contains commas/tabs and newlines)
    if (
      (content.includes(',') || content.includes('\t')) &&
      (content.includes('\n') || content.includes('\r'))
    ) {
      return FileFormat.CSV;
    }

    this.logger.warn('Unable to detect format from content');
    return null;
  }

  /**
   * Get parser with auto-detection
   * @param filename File name
   * @param mimeType Optional MIME type
   * @param fileBuffer Optional file buffer for content detection
   * @returns Parser instance
   */
  getParserAuto(
    filename: string,
    mimeType?: string,
    fileBuffer?: Buffer,
  ): IFileParser {
    this.logger.log(`Auto-detecting parser for file: ${filename}`);

    let format: FileFormat | null = null;

    // Try detecting from filename first
    try {
      format = this.detectFormatFromFilename(filename);
      this.logger.log(`Format detected from filename: ${format}`);
      return this.getParser(format);
    } catch (error) {
      this.logger.warn(`Could not detect from filename: ${error.message}`);
    }

    // Try detecting from MIME type
    if (mimeType) {
      try {
        format = this.detectFormatFromMimeType(mimeType);
        this.logger.log(`Format detected from MIME type: ${format}`);
        return this.getParser(format);
      } catch (error) {
        this.logger.warn(`Could not detect from MIME type: ${error.message}`);
      }
    }

    // Try detecting from content
    if (fileBuffer) {
      try {
        format = this.detectFormatFromContent(fileBuffer);
        if (format) {
          this.logger.log(`Format detected from content: ${format}`);
          return this.getParser(format);
        }
      } catch (error) {
        this.logger.warn(`Could not detect from content: ${error.message}`);
      }
    }

    throw new Error(
      `Unable to auto-detect file format for: ${filename}. Please specify format explicitly.`,
    );
  }

  /**
   * Get supported file formats
   * @returns Array of supported formats
   */
  getSupportedFormats(): string[] {
    return Object.values(FileFormat);
  }

  /**
   * Check if format is supported
   * @param format Format to check
   * @returns True if supported
   */
  isFormatSupported(format: string): boolean {
    return Object.values(FileFormat).includes(format as FileFormat);
  }

  /**
   * Get file extensions for format
   * @param format File format
   * @returns Array of extensions
   */
  getExtensionsForFormat(format: FileFormat): string[] {
    switch (format) {
      case FileFormat.CSV:
        return ['csv', 'tsv', 'txt'];

      case FileFormat.EXCEL:
        return ['xlsx', 'xls', 'xlsm', 'xlsb'];

      case FileFormat.JSON:
        return ['json', 'jsonl'];

      case FileFormat.XML:
        return ['xml'];

      default:
        return [];
    }
  }

  /**
   * Get MIME types for format
   * @param format File format
   * @returns Array of MIME types
   */
  getMimeTypesForFormat(format: FileFormat): string[] {
    switch (format) {
      case FileFormat.CSV:
        return ['text/csv', 'text/tab-separated-values', 'text/plain'];

      case FileFormat.EXCEL:
        return [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ];

      case FileFormat.JSON:
        return ['application/json'];

      case FileFormat.XML:
        return ['application/xml', 'text/xml'];

      default:
        return [];
    }
  }
}
