import { PartialType } from '@nestjs/swagger';
import { CreateAlertRuleDto } from './create-alert-rule.dto';

/**
 * DTO for updating an existing alert rule
 * All fields from CreateAlertRuleDto are optional
 */
export class UpdateAlertRuleDto extends PartialType(CreateAlertRuleDto) {}
