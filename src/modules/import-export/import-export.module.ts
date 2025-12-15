import { Module, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
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

const logger = new Logger('ImportExportModule');

// Check if Redis is configured (required for BullMQ)
const REDIS_ENABLED = !!(process.env.REDIS_URL || process.env.REDIS_HOST);

if (!REDIS_ENABLED) {
  logger.warn('⚠️ Redis not configured - Import/Export background jobs will be disabled');
}

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    // Only register Bull queues if Redis is available
    ...(REDIS_ENABLED
      ? [
          BullModule.registerQueue(
            { name: 'import' },
            { name: 'export' },
            { name: 'cleanup' },
          ),
        ]
      : []),
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

    // Processors (only if Redis is available)
    ...(REDIS_ENABLED ? [ImportProcessor, ExportProcessor] : []),

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
