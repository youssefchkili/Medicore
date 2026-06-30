import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import type { Profile } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  getUsers(@Query('role') role?: string) {
    return this.adminService.getUsers(role);
  }

  @Patch('users/:id/toggle')
  toggleUser(
    @CurrentUser() actor: Profile,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.toggleUser(actor.id, id);
  }

  @Post('doctors/approve/:profileId')
  approveDoctor(
    @CurrentUser() actor: Profile,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    return this.adminService.approveDoctor(actor.id, profileId);
  }

  @Get('audit-logs')
  getAuditLogs(@Query('limit') limit?: string) {
    return this.adminService.getAuditLogs(limit ? parseInt(limit, 10) : 100);
  }
}
