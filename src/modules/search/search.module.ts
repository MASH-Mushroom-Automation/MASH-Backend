import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ElasticsearchModule } from './elasticsearch/elasticsearch.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ProductIndexerService } from './indexers/product-indexer.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [ConfigModule, ElasticsearchModule, DatabaseModule],
  controllers: [SearchController],
  providers: [SearchService, ProductIndexerService],
  exports: [SearchService, ProductIndexerService],
})
export class SearchModule {}
