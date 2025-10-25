import { Injectable, Logger } from '@nestjs/common';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import * as fs from 'fs';

export interface XmlParseOptions {
  arrayPath?: string; // Path to array in XML (e.g., 'root.items.item')
  ignoreAttributes?: boolean; // Ignore XML attributes (default: false)
  attributeNamePrefix?: string; // Prefix for attribute names (default: '@_')
  textNodeName?: string; // Name for text content nodes (default: '#text')
  parseTagValue?: boolean; // Parse tag values (default: true)
  trimValues?: boolean; // Trim whitespace from values (default: true)
}

export interface XmlParsedData {
  data: any[];
  rootElement: string;
  totalRecords: number;
}

@Injectable()
export class XmlParserService {
  private readonly logger = new Logger(XmlParserService.name);

  /**
   * Parse XML file from buffer
   * @param fileBuffer Buffer containing XML data
   * @param options Parsing options
   * @returns Parsed data
   */
  parse(fileBuffer: Buffer, options: XmlParseOptions = {}): XmlParsedData {
    this.logger.log('Parsing XML file from buffer');

    try {
      const parser = new XMLParser({
        ignoreAttributes: options.ignoreAttributes || false,
        attributeNamePrefix: options.attributeNamePrefix || '@_',
        textNodeName: options.textNodeName || '#text',
        parseTagValue: options.parseTagValue !== false,
        trimValues: options.trimValues !== false,
        ignoreDeclaration: true,
        removeNSPrefix: true, // Remove namespace prefixes
      });

      const xmlString = fileBuffer.toString('utf-8');
      const parsed = parser.parse(xmlString);

      // Get root element
      const rootKeys = Object.keys(parsed);
      if (rootKeys.length === 0) {
        throw new Error('Empty XML document');
      }

      const rootElement = rootKeys[0];
      let data: any[] = [];

      // Extract array from specified path
      if (options.arrayPath) {
        data = this.getNestedValue(parsed, options.arrayPath);
      } else {
        // Try to find array in root element
        const rootData = parsed[rootElement];

        if (Array.isArray(rootData)) {
          data = rootData;
        } else if (typeof rootData === 'object') {
          // Look for arrays in root object
          const arrayKeys = Object.keys(rootData).filter((key) =>
            Array.isArray(rootData[key]),
          );

          if (arrayKeys.length > 0) {
            // Use first array found
            data = rootData[arrayKeys[0]];
          } else {
            // Single record
            data = [rootData];
          }
        } else {
          throw new Error(
            'Invalid XML structure: expected object or array in root element',
          );
        }
      }

      // Ensure data is array
      if (!Array.isArray(data)) {
        data = [data];
      }

      this.logger.log(
        `XML parsing complete: ${data.length} records from root element "${rootElement}"`,
      );

      return {
        data,
        rootElement,
        totalRecords: data.length,
      };
    } catch (error) {
      this.logger.error('XML parsing failed', error);
      throw new Error(`XML parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse XML file from path with streaming support
   * @param filePath Path to XML file
   * @param options Parsing options
   * @param onData Callback for each parsed record
   * @returns Promise with parsing summary
   */
  async parseStream(
    filePath: string,
    options: XmlParseOptions = {},
    onData: (row: any, index: number) => Promise<void>,
  ): Promise<{ totalRows: number; errors: any[] }> {
    this.logger.log(`Streaming XML file: ${filePath}`);

    const errors: any[] = [];
    let rowCount = 0;

    try {
      // Read file (XML doesn't support true streaming parsing)
      const fileBuffer = fs.readFileSync(filePath);
      const parsed = this.parse(fileBuffer, options);

      // Process records
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
        `XML streaming complete: ${rowCount} rows, ${errors.length} errors`,
      );

      return { totalRows: rowCount, errors };
    } catch (error) {
      this.logger.error('XML streaming failed', error);
      throw new Error(`XML streaming failed: ${error.message}`);
    }
  }

  /**
   * Generate XML from data array
   * @param data Array of objects to convert to XML
   * @param options Generation options
   * @returns XML string
   */
  generate(
    data: any[],
    options: {
      rootElement?: string;
      itemElement?: string;
      pretty?: boolean;
      ignoreAttributes?: boolean;
      attributeNamePrefix?: string;
    } = {},
  ): string {
    this.logger.log(`Generating XML from ${data.length} records`);

    try {
      const builder = new XMLBuilder({
        ignoreAttributes: options.ignoreAttributes || false,
        attributeNamePrefix: options.attributeNamePrefix || '@_',
        format: options.pretty !== false,
        indentBy: '  ',
        suppressEmptyNode: true,
      });

      // Wrap data in root and item elements
      const rootElement = options.rootElement || 'root';
      const itemElement = options.itemElement || 'item';

      const xmlObject = {
        [rootElement]: {
          [itemElement]: data,
        },
      };

      // Add XML declaration
      const xml =
        '<?xml version="1.0" encoding="UTF-8"?>\n' + builder.build(xmlObject);

      return xml;
    } catch (error) {
      this.logger.error('XML generation failed', error);
      throw new Error(`XML generation failed: ${error.message}`);
    }
  }

  /**
   * Validate XML structure
   * @param fileBuffer Buffer containing XML data
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
        errors.push('XML file contains no records');
        return { valid: false, errors, foundFields: [] };
      }

      // Get fields from first record
      const firstRecord = parsed.data[0];
      const foundFields = this.getObjectKeys(firstRecord);

      // Check for missing required fields
      const missingFields = requiredFields.filter(
        (field) => !foundFields.includes(field),
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
        errors: [`XML validation failed: ${error.message}`],
        foundFields: [],
      };
    }
  }

  /**
   * Get XML preview (first N records)
   * @param fileBuffer Buffer containing XML data
   * @param recordCount Number of records to preview
   * @returns Preview data
   */
  preview(
    fileBuffer: Buffer,
    recordCount: number = 10,
  ): {
    data: any[];
    rootElement: string;
    fields: string[];
    totalRecords: number;
  } {
    const parsed = this.parse(fileBuffer);

    const fields =
      parsed.data.length > 0 ? this.getObjectKeys(parsed.data[0]) : [];

    return {
      data: parsed.data.slice(0, recordCount),
      rootElement: parsed.rootElement,
      fields,
      totalRecords: parsed.totalRecords,
    };
  }

  /**
   * Detect XML structure
   * @param fileBuffer Buffer containing XML data
   * @returns Structure information
   */
  detectStructure(fileBuffer: Buffer): {
    rootElement: string;
    arrayPaths: string[];
    sampleRecord: any;
  } {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        removeNSPrefix: true,
      });

      const xmlString = fileBuffer.toString('utf-8');
      const parsed = parser.parse(xmlString);

      const rootKeys = Object.keys(parsed);
      const rootElement = rootKeys[0];
      const arrayPaths: string[] = [];

      // Find array paths
      this.findArrayPaths(parsed, '', arrayPaths);

      // Get sample record
      let sampleRecord: any = null;
      if (arrayPaths.length > 0) {
        const firstArray = this.getNestedValue(parsed, arrayPaths[0]);
        sampleRecord = Array.isArray(firstArray) ? firstArray[0] : firstArray;
      } else {
        sampleRecord = parsed[rootElement];
      }

      return {
        rootElement,
        arrayPaths,
        sampleRecord,
      };
    } catch (error) {
      throw new Error(`Failed to detect XML structure: ${error.message}`);
    }
  }

  /**
   * Get nested value from object by path
   * @param obj Object to search
   * @param path Dot-notation path
   * @returns Nested value or undefined
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current?.[key];
    }, obj);
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

  /**
   * Get all keys from object (including nested)
   * @param obj Object to extract keys from
   * @returns Array of keys
   */
  private getObjectKeys(obj: any): string[] {
    const keys: string[] = [];

    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;

      // Skip attributes and text nodes
      if (key.startsWith('@_') || key === '#text') continue;

      keys.push(key);
    }

    return keys;
  }

  /**
   * Validate XML against schema (basic validation)
   * @param fileBuffer Buffer containing XML data
   * @returns Validation result
   */
  validateXmlSyntax(fileBuffer: Buffer): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      const parser = new XMLParser();
      const xmlString = fileBuffer.toString('utf-8');
      parser.parse(xmlString);

      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [`Invalid XML syntax: ${error.message}`],
      };
    }
  }
}
