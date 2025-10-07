import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { AvatarService } from './services/avatar.service';
import { ImageProcessorService } from './services/image-processor.service';
import { SessionManagementService } from './services/session-management.service';
import { ApiKeyService } from './services/api-key.service';
import { SecurityLogService } from './services/security-log.service';
import { TwoFactorService } from './services/two-factor.service';
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
    ApiKeyService,
    SecurityLogService,
    TwoFactorService,
  ],
  exports: [
    ProfileService,
    AvatarService,
    SessionManagementService,
    ApiKeyService,
    SecurityLogService,
    TwoFactorService,
  ],
})
export class ProfileModule {}
