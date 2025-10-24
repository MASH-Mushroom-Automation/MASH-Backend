import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { FileStorageService } from './services/file-storage.service';

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
  providers: [FileStorageService],
  exports: [FileStorageService],
})
export class ImportExportModule {}
