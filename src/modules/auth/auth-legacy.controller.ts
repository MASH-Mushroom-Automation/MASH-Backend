import { Controller, Post, Body, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { FirebaseSyncDto } from './dto/firebase-sync.dto';
import { Public } from './decorators/public.decorator';

/**
 * This is a temporary, non-prefixed controller to handle frontend calls
 * that are not using the /api/v1 global prefix.
 *
 * @deprecated Should be removed once frontend calls are updated to use the full path.
 */
@ApiExcludeController()
@Controller('auth')
export class AuthLegacyController {
  constructor(private readonly authService: AuthService) {}

  @Post('firebase-sync')
  @Public()
  @HttpCode(HttpStatus.OK)
  firebaseSync(@Body() dto: FirebaseSyncDto, @Request() req: any) {
    return this.authService.firebaseSync(dto, req.res);
  }

  @Post('firebase')
  @Public()
  @HttpCode(HttpStatus.OK)
  firebaseLogin(@Body() dto: FirebaseSyncDto, @Request() req: any) {
    return this.authService.firebaseSync(dto, req.res);
  }
}
