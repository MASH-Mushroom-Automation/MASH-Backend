import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ElasticsearchModule } from './elasticsearch/elasticsearch.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [ConfigModule, ElasticsearchModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
