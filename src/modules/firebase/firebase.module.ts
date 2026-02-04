import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// Import early to trigger Firebase initialization at module load time
import { FirebaseConfigService } from '../../config/firebase.config';

/**
 * FirebaseModule - Global module for Firebase Admin SDK
 *
 * This module initializes the Firebase Admin SDK and makes it available
 * throughout the application. It should be imported in the AppModule.
 *
 * IMPORTANT: Firebase SDK is initialized at module load time (not lifecycle hooks)
 * to ensure it's available when other providers are instantiated.
 *
 * Usage:
 * - Import FirebaseModule in AppModule
 * - Inject FirebaseConfigService where needed
 * - Or use admin.auth() directly after initialization
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [FirebaseConfigService],
  exports: [FirebaseConfigService],
})
export class FirebaseModule {}
