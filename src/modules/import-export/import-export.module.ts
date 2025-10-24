import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { FileStorageService } from './services/file-storage.service';
import { CsvParserService } from './parsers/csv-parser.service';
import { ExcelParserService } from './parsers/excel-parser.service';
import { JsonParserService } from './parsers/json-parser.service';
import { XmlParserService } from './parsers/xml-parser.service';
import { FileParserFactory } from './parsers/file-parser.factory';

@Module({
  imports: [
    ConfigModule,
    // Register Bull queues for background job processing
    BullModule.registerQueue(
      {
        name: 'import',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: false,
          removeOnFail: false,
        },
      },
      {
        name: 'export',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: false,
          removeOnFail: false,
        },
      },
      {
        name: 'cleanup',
        defaultJobOptions: {
          attempts: 2,
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
    ),
  ],
  controllers: [],
  providers: [
    // File Storage
    FileStorageService,
    // File Parsers
    CsvParserService,
    ExcelParserService,
    JsonParserService,
    XmlParserService,
    FileParserFactory,
  ],
  exports: [
    FileStorageService,
    FileParserFactory,
    CsvParserService,
    ExcelParserService,
    JsonParserService,
    XmlParserService,
  ],
})
export class ImportExportModule {}
