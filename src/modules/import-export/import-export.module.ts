import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FileStorageService } from './services/file-storage.service';

@Module({
  imports: [
    ConfigModule,
    // Register Bull queues for background job processing
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
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
    // Bull Board for queue monitoring dashboard
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'import',
      adapter: BullAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'export',
      adapter: BullAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'cleanup',
      adapter: BullAdapter,
    }),
  ],
  controllers: [],
  providers: [FileStorageService],
  exports: [FileStorageService],
})
export class ImportExportModule {}
