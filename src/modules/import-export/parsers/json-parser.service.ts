import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { Readable } from 'stream';

export interface JsonParseOptions {
  arrayPath?: string; // Path to array in nested JSON (e.g., 'data.items')
  flatten?: boolean; // Flatten nested objects (default: false)
  maxDepth?: number; // Max nesting depth when flattening (default: 10)
}

export interface JsonParsedData {
  data: any[];
  structure: 'array' | 'object' | 'nested';
  totalRecords: number;
}

@Injectable()
export class JsonParserService {
  private readonly logger = new Logger(JsonParserService.name);

  /**
   * Parse JSON file from buffer
   * @param fileBuffer Buffer containing JSON data
   * @param options Parsing options
   * @returns Parsed data
   */
  parse(
    fileBuffer: Buffer,
    options: JsonParseOptions = {},
  ): JsonParsedData {
    this.logger.log('Parsing JSON file from buffer');

    try {
      const jsonString = fileBuffer.toString('utf-8');
      let parsed = JSON.parse(jsonString);

      // Extract array from nested path if specified
      if (options.arrayPath) {
        parsed = this.getNestedValue(parsed, options.arrayPath);
      }

      // Determine structure
      let structure: 'array' | 'object' | 'nested' = 'array';
      let data: any[] = [];

      if (Array.isArray(parsed)) {
        structure = 'array';
        data = parsed;
      } else if (typeof parsed === 'object') {
        // Check if it's a nested structure with an array
        const arrayKeys = Object.keys(parsed).filter((key) =>
          Array.isArray(parsed[key]),
        );

        if (arrayKeys.length === 1) {
          structure = 'nested';
          data = parsed[arrayKeys[0]];
        } else {
          structure = 'object';
          data = [parsed]; // Wrap single object in array
        }
      } else {
        throw new Error('Invalid JSON structure: expected object or array');
      }

      // Flatten nested objects if requested
      if (options.flatten) {
        data = data.map((item) =>
          this.flattenObject(item, options.maxDepth || 10),
        );
      }

      this.logger.log(
        `JSON parsing complete: ${data.length} records, structure: ${structure}`,
      );

      return {
        data,
        structure,
        totalRecords: data.length,
      };
    } catch (error) {
      this.logger.error('JSON parsing failed', error);
      throw new Error(`JSON parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse JSON file from path with streaming support (for large files)
   * @param filePath Path to JSON file
   * @param options Parsing options
   * @param onData Callback for each parsed record
   * @returns Promise with parsing summary
   */
  async parseStream(
    filePath: string,
    options: JsonParseOptions = {},
    onData: (row: any, index: number) => Promise<void>,
  ): Promise<{ totalRows: number; errors: any[] }> {
    this.logger.log(`Streaming JSON file: ${filePath}`);

    const errors: any[] = [];
    let rowCount = 0;

    try {
      // Read entire file (JSON doesn't support true streaming parsing)
      const fileBuffer = fs.readFileSync(filePath);
      const parsed = this.parse(fileBuffer, options);

      // Process rows
      for (let i = 0; i < parsed.data.length; i++) {
        try {
          await onData(parsed.data[i], i);
          rowCount++;
        } catch (error) {
          this.logger.error(`Error processing row ${i}`, error);
          errors.push({
            row: i,
            error: error.message,
            data: parsed.data[i],
          });
        }
      }

      this.logger.log(
        `JSON streaming complete: ${rowCount} rows, ${errors.length} errors`,
      );

      return { totalRows: rowCount, errors };
    } catch (error) {
      this.logger.error('JSON streaming failed', error);
      throw new Error(`JSON streaming failed: ${error.message}`);
    }
  }

  /**
   * Generate JSON from data array
   * @param data Array of objects to convert to JSON
   * @param options Generation options
   * @returns JSON string
   */
  generate(
    data: any[],
    options: {
      pretty?: boolean;
      wrapper?: string; // Wrap array in object key
    } = {},
  ): string {
    this.logger.log(`Generating JSON from ${data.length} records`);

    try {
      let output = data;

      // Wrap in object if requested
      if (options.wrapper) {
        output = { [options.wrapper]: data } as any;
      }

      // Convert to JSON
      const json = JSON.stringify(
        output,
        null,
        options.pretty ? 2 : undefined,
      );

      return json;
    } catch (error) {
      this.logger.error('JSON generation failed', error);
      throw new Error(`JSON generation failed: ${error.message}`);
    }
  }

  /**
   * Validate JSON structure
   * @param fileBuffer Buffer containing JSON data
   * @param requiredFields Expected field names
   * @returns Validation result
   */
  validate(
    fileBuffer: Buffer,
    requiredFields: string[],
  ): { valid: boolean; errors: string[]; foundFields: string[] } {
    const errors: string[] = [];

    try {
      const parsed = this.parse(fileBuffer);

      if (parsed.data.length === 0) {
        errors.push('JSON file contains no records');
        return { valid: false, errors, foundFields: [] };
      }

      // Get fields from first record
      const firstRecord = parsed.data[0];
      const foundFields = Object.keys(firstRecord);

      // Check for missing required fields
      const missingFields = requiredFields.filter(
        (field) => !(field in firstRecord),
      );

      if (missingFields.length > 0) {
        errors.push(
          `Missing required fields: ${missingFields.join(', ')}. Found fields: ${foundFields.join(', ')}`,
        );
      }

      return {
        valid: errors.length === 0,
        errors,
        foundFields,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`JSON validation failed: ${error.message}`],
        foundFields: [],
      };
    }
  }

  /**
   * Get JSON preview (first N records)
   * @param fileBuffer Buffer containing JSON data
   * @param recordCount Number of records to preview
   * @returns Preview data
   */
  preview(
    fileBuffer: Buffer,
    recordCount: number = 10,
  ): {
    data: any[];
    structure: string;
    fields: string[];
    totalRecords: number;
  } {
    const parsed = this.parse(fileBuffer);

    const fields =
      parsed.data.length > 0 ? Object.keys(parsed.data[0]) : [];

    return {
      data: parsed.data.slice(0, recordCount),
      structure: parsed.structure,
      fields,
      totalRecords: parsed.totalRecords,
    };
  }

  /**
   * Get nested value from object by path
   * @param obj Object to search
   * @param path Dot-notation path (e.g., 'data.items')
   * @returns Nested value or undefined
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current?.[key];
    }, obj);
  }

  /**
   * Flatten nested object
   * @param obj Object to flatten
   * @param maxDepth Maximum nesting depth
   * @param prefix Current key prefix (for recursion)
   * @param depth Current depth (for recursion)
   * @returns Flattened object
   */
  private flattenObject(
    obj: any,
    maxDepth: number = 10,
    prefix: string = '',
    depth: number = 0,
  ): any {
    if (depth >= maxDepth) {
      return { [prefix]: obj };
    }

    const flattened: any = {};

    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;

      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        Object.assign(
          flattened,
          this.flattenObject(value, maxDepth, newKey, depth + 1),
        );
      } else {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  /**
   * Detect JSON structure type
   * @param fileBuffer Buffer containing JSON data
   * @returns Structure information
   */
  detectStructure(fileBuffer: Buffer): {
    type: 'array' | 'object' | 'nested';
    arrayPaths: string[];
    sampleRecord: any;
  } {
    try {
      const jsonString = fileBuffer.toString('utf-8');
      const parsed = JSON.parse(jsonString);

      let type: 'array' | 'object' | 'nested' = 'object';
      const arrayPaths: string[] = [];
      let sampleRecord: any = null;

      if (Array.isArray(parsed)) {
        type = 'array';
        sampleRecord = parsed[0];
      } else if (typeof parsed === 'object') {
        // Find all array paths
        this.findArrayPaths(parsed, '', arrayPaths);

        if (arrayPaths.length > 0) {
          type = 'nested';
          // Get sample from first array found
          const firstArray = this.getNestedValue(parsed, arrayPaths[0]);
          sampleRecord = firstArray[0];
        } else {
          type = 'object';
          sampleRecord = parsed;
        }
      }

      return {
        type,
        arrayPaths,
        sampleRecord,
      };
    } catch (error) {
      throw new Error(`Failed to detect JSON structure: ${error.message}`);
    }
  }

  /**
   * Find all array paths in nested object
   * @param obj Object to search
   * @param currentPath Current path prefix
   * @param paths Array to collect paths
   */
  private findArrayPaths(obj: any, currentPath: string, paths: string[]): void {
    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;

      const value = obj[key];
      const newPath = currentPath ? `${currentPath}.${key}` : key;

      if (Array.isArray(value)) {
        paths.push(newPath);
      } else if (typeof value === 'object' && value !== null) {
        this.findArrayPaths(value, newPath, paths);
      }
    }
  }
}
