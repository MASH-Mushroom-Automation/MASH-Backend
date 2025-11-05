import { Module } from '@nestjs/common';
import { AlertRuleService } from './services/alert-rule.service';
import { AlertEngineService } from './services/alert-engine.service';
import { AlertHistoryService } from './services/alert-history.service';
import { AlertRulesController } from './controllers/alert-rules.controller';
import { AlertsController } from './controllers/alerts.controller';
import { QueuesModule } from '../queues/queues.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [QueuesModule, DatabaseModule],
  providers: [AlertRuleService, AlertEngineService, AlertHistoryService],
  controllers: [AlertRulesController, AlertsController],
  exports: [AlertRuleService, AlertEngineService, AlertHistoryService],
})
export class AlertsModule {}
