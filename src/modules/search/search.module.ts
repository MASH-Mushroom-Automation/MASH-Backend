import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ElasticsearchModule } from './elasticsearch/elasticsearch.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ProductIndexerService } from './indexers/product-indexer.service';
import { SearchAnalyticsService } from './analytics/search-analytics.service';
import { SearchAnalyticsController } from './analytics/search-analytics.controller';
import { DatabaseModule } from '../../database/database.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [ConfigModule, ElasticsearchModule, DatabaseModule, CommonModule],
  controllers: [SearchController, SearchAnalyticsController],
  providers: [SearchService, ProductIndexerService, SearchAnalyticsService],
  exports: [SearchService, ProductIndexerService, SearchAnalyticsService],
})
export class SearchModule {}
