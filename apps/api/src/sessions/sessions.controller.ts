import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { EndSessionDto } from './dto/end-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../generated/prisma';
import type { Doctor, Patient, Profile } from '../generated/prisma';

type AuthUser = Profile & { doctor: Doctor | null; patient: Patient | null };

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Get()
  findMy(@CurrentUser() user: AuthUser) {
    return this.sessionsService.findMy(user);
  }

  @Get(':id')
  findById(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sessionsService.findById(user, id);
  }

  // Doctor creates a session for one of their confirmed appointments.
  // The returned session.id is what the doctor's browser uses to open
  // the emotion WebSocket at ws://<ai-service>/emotion/stream/{session.id}
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSessionDto) {
    return this.sessionsService.create(user, dto);
  }

  @Patch(':id/start')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  start(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sessionsService.start(user, id);
  }

  @Patch(':id/end')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  end(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EndSessionDto,
  ) {
    return this.sessionsService.end(user, id, dto);
  }
}
