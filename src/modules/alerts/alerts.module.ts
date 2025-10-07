import { Module } from '@nestjs/common';
import { AlertRuleService } from './services/alert-rule.service';
import { AlertEngineService } from './services/alert-engine.service';
import { AlertRulesController } from './controllers/alert-rules.controller';

@Module({
  providers: [AlertRuleService, AlertEngineService],
  controllers: [AlertRulesController]
})
export class AlertsModule {}
