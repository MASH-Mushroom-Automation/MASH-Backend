import { Module } from '@nestjs/common';
import { AuthViewsController } from './auth-views.controller';

/**
 * Auth Views Module
 * Handles serving HTML pages for authentication
 */
@Module({
  controllers: [AuthViewsController],
})
export class AuthViewsModule {}
