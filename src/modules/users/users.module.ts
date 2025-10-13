import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FileValidationService } from '../../common/services/file-validation.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, FileValidationService],
  exports: [UsersService],
})
export class UsersModule {}
