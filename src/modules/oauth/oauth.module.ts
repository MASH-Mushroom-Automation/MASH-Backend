import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OAuthService } from './oauth.service';

/**
 * OAuth Module
 * Provides OAuth authentication services for Google and Facebook
 */
@Module({
  imports: [ConfigModule],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
