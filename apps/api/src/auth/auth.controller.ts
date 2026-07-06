import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SyncProfileDto } from './dto/sync-profile.dto';
import { JwtVerifyGuard } from './guards/jwt-verify.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('sync-profile')
  @UseGuards(JwtVerifyGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  syncProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: SyncProfileDto,
  ) {
    return this.authService.syncProfile(user.id, dto);
  }
}
