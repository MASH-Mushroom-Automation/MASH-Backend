import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export enum MaintenanceAction {
  CLEAR_CACHE = 'CLEAR_CACHE',
  REBUILD_INDEX = 'REBUILD_INDEX',
  OPTIMIZE_DATABASE = 'OPTIMIZE_DATABASE',
  CLEANUP_LOGS = 'CLEANUP_LOGS',
}

export class MaintenanceDto {
  @ApiProperty({
    description: 'Maintenance action to perform',
    enum: MaintenanceAction,
    example: MaintenanceAction.CLEAR_CACHE,
  })
  @IsEnum(MaintenanceAction)
  @IsNotEmpty()
  action: MaintenanceAction;
}
