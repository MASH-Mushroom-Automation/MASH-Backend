import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AlertRuleService } from './services/alert-rule.service';
import { AlertEngineService } from './services/alert-engine.service';
import { AlertRulesController } from './controllers/alert-rules.controller';

@Module({
  providers: [PrismaService, AlertRuleService, AlertEngineService],
  controllers: [AlertRulesController],
  exports: [AlertRuleService, AlertEngineService],
})
export class AlertsModule {}
