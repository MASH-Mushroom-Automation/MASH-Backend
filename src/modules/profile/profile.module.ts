import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { AvatarService } from './services/avatar.service';
import { ImageProcessorService } from './services/image-processor.service';
import { SessionManagementService } from './services/session-management.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ProfileController],
  providers: [
    ProfileService,
    AvatarService,
    ImageProcessorService,
    SessionManagementService,
  ],
  exports: [ProfileService, AvatarService, SessionManagementService],
})
export class ProfileModule {}
