import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { FileStorageService } from './services/file-storage.service';
import { ValidationService } from './services/validation.service';
import { ImportService } from './services/import.service';
import { ExportService } from './services/export.service';
import { CsvParserService } from './parsers/csv-parser.service';
import { ExcelParserService } from './parsers/excel-parser.service';
import { JsonParserService } from './parsers/json-parser.service';
import { XmlParserService } from './parsers/xml-parser.service';
import { FileParserFactory } from './parsers/file-parser.factory';
import { ProductImportValidator } from './validators/product-import.validator';
import { UserImportValidator } from './validators/user-import.validator';
import { OrderImportValidator } from './validators/order-import.validator';
import { ImportProcessor } from './processors/import.processor';
import { ExportProcessor } from './processors/export.processor';
import { ImportExportGateway } from './gateways/import-export.gateway';
import { ImportController } from './controllers/import.controller';
import { ExportController } from './controllers/export.controller';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule, // Add DatabaseModule for Prisma access
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
  controllers: [ImportController, ExportController],
  providers: [
    // File Storage
    FileStorageService,

    // Services
    ValidationService,
    ImportService,
    ExportService,

    // File Parsers
    CsvParserService,
    ExcelParserService,
    JsonParserService,
    XmlParserService,
    FileParserFactory,

    // Entity Validators
    ProductImportValidator,
    UserImportValidator,
    OrderImportValidator,

    // Processors
    ImportProcessor,
    ExportProcessor,

    // WebSocket Gateway
    ImportExportGateway,
  ],
  exports: [
    FileStorageService,
    ValidationService,
    ImportService,
    ExportService,
    FileParserFactory,
    CsvParserService,
    ExcelParserService,
    JsonParserService,
    XmlParserService,
    ProductImportValidator,
    UserImportValidator,
    OrderImportValidator,
  ],
})
export class ImportExportModule {}
