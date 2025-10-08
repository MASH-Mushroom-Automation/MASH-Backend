import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';
import { FileValidationService } from '../../common/services/file-validation.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService, FileValidationService],
  exports: [UsersService],
})
export class UsersModule {}
