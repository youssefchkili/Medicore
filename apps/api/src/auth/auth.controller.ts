import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SyncProfileDto } from './dto/sync-profile.dto';
import { JwtVerifyGuard } from './guards/jwt-verify.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // JwtVerifyGuard: validates the Supabase JWT cryptographically without a DB lookup.
  // This allows the call even before the Profile row exists, while still ensuring
  // only a real authenticated Supabase user can create/claim their profile.
  @Post('sync-profile')
  @UseGuards(JwtVerifyGuard)
  @HttpCode(HttpStatus.OK)
  syncProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: SyncProfileDto,
  ) {
    // user.id comes from the verified JWT — the body cannot override this
    return this.authService.syncProfile(user.id, dto);
  }
}
