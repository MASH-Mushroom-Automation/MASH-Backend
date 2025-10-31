import { Test, TestingModule } from '@nestjs/testing';
import { FileParserFactory, FileFormat } from '../file-parser.factory';
import { CsvParserService } from '../csv-parser.service';
import { ExcelParserService } from '../excel-parser.service';
import { JsonParserService } from '../json-parser.service';
import { XmlParserService } from '../xml-parser.service';

describe('FileParserFactory', () => {
  let factory: FileParserFactory;
  let csvParser: CsvParserService;
  let excelParser: ExcelParserService;
  let jsonParser: JsonParserService;
  let xmlParser: XmlParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileParserFactory,
        CsvParserService,
        ExcelParserService,
        JsonParserService,
        XmlParserService,
      ],
    }).compile();

    factory = module.get<FileParserFactory>(FileParserFactory);
    csvParser = module.get<CsvParserService>(CsvParserService);
    excelParser = module.get<ExcelParserService>(ExcelParserService);
    jsonParser = module.get<JsonParserService>(JsonParserService);
    xmlParser = module.get<XmlParserService>(XmlParserService);
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  describe('getParser', () => {
    it('should return CSV parser for CSV format', () => {
      const parser = factory.getParser(FileFormat.CSV);
      expect(parser).toBe(csvParser);
    });

    it('should return Excel parser for EXCEL format', () => {
      const parser = factory.getParser(FileFormat.EXCEL);
      expect(parser).toBe(excelParser);
    });

    it('should return JSON parser for JSON format', () => {
      const parser = factory.getParser(FileFormat.JSON);
      expect(parser).toBe(jsonParser);
    });

    it('should return XML parser for XML format', () => {
      const parser = factory.getParser(FileFormat.XML);
      expect(parser).toBe(xmlParser);
    });

    it('should throw error for unsupported format', () => {
      expect(() => factory.getParser('INVALID' as FileFormat)).toThrow('Unsupported file format');
    });
  });

  describe('detectFormatFromFilename', () => {
    it('should detect CSV from .csv extension', () => {
      expect(factory.detectFormatFromFilename('data.csv')).toBe(FileFormat.CSV);
    });

    it('should detect Excel from .xlsx extension', () => {
      expect(factory.detectFormatFromFilename('data.xlsx')).toBe(FileFormat.EXCEL);
    });

    it('should detect JSON from .json extension', () => {
      expect(factory.detectFormatFromFilename('data.json')).toBe(FileFormat.JSON);
    });

    it('should detect XML from .xml extension', () => {
      expect(factory.detectFormatFromFilename('data.xml')).toBe(FileFormat.XML);
    });

    it('should be case insensitive', () => {
      expect(factory.detectFormatFromFilename('data.CSV')).toBe(FileFormat.CSV);
      expect(factory.detectFormatFromFilename('data.XLSX')).toBe(FileFormat.EXCEL);
    });
  });

  describe('detectFormatFromMimeType', () => {
    it('should detect CSV from text/csv MIME type', () => {
      expect(factory.detectFormatFromMimeType('text/csv')).toBe(FileFormat.CSV);
    });

    it('should detect Excel from Excel MIME types', () => {
      expect(
        factory.detectFormatFromMimeType(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ),
      ).toBe(FileFormat.EXCEL);

      expect(factory.detectFormatFromMimeType('application/vnd.ms-excel')).toBe(FileFormat.EXCEL);
    });

    it('should detect JSON from application/json MIME type', () => {
      expect(factory.detectFormatFromMimeType('application/json')).toBe(FileFormat.JSON);
    });

    it('should detect XML from XML MIME types', () => {
      expect(factory.detectFormatFromMimeType('application/xml')).toBe(FileFormat.XML);
      expect(factory.detectFormatFromMimeType('text/xml')).toBe(FileFormat.XML);
    });
  });

  describe('getSupportedFormats', () => {
    it('should return all supported formats', () => {
      const formats = factory.getSupportedFormats();
      expect(formats).toContain(FileFormat.CSV);
      expect(formats).toContain(FileFormat.EXCEL);
      expect(formats).toContain(FileFormat.JSON);
      expect(formats).toContain(FileFormat.XML);
      expect(formats).toHaveLength(4);
    });
  });

  describe('isFormatSupported', () => {
    it('should return true for supported formats', () => {
      expect(factory.isFormatSupported('CSV')).toBe(true);
      expect(factory.isFormatSupported('EXCEL')).toBe(true);
      expect(factory.isFormatSupported('JSON')).toBe(true);
      expect(factory.isFormatSupported('XML')).toBe(true);
    });

    it('should return false for unsupported formats', () => {
      expect(factory.isFormatSupported('PDF')).toBe(false);
      expect(factory.isFormatSupported('DOC')).toBe(false);
    });
  });
});
