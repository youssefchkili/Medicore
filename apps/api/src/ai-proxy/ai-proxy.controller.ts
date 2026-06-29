import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AiProxyService } from './ai-proxy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InternalSecretGuard } from '../auth/guards/internal-secret.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StartChatDto } from './dto/start-chat.dto';
import { DiagnosticWebhookDto } from './dto/diagnostic-webhook.dto';
import { Role } from '../generated/prisma';
import type { Doctor, Profile } from '../generated/prisma';

@Controller('ai-proxy')
export class AiProxyController {
  constructor(private aiProxyService: AiProxyService) {}

  // Patient calls this to get a chatSessionId + wsPath before opening the WebSocket
  @Post('chat/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  startChat(@CurrentUser() user: Profile & { patient: { id: string } | null }) {
    if (!user.patient) {
      // Patient sub-record not yet initialised — tell frontend to call /users/me/patient/init first
      throw new Error('Patient record not initialised. Call POST /users/me/patient/init first.');
    }
    return this.aiProxyService.startChatSession(user.patient.id);
  }

  // FastAPI calls this after saving the pre_diagnostic to Supabase
  // Protected by X-Internal-Secret header — not a Supabase JWT
  @Post('webhook/diagnostic-complete')
  @UseGuards(InternalSecretGuard)
  @HttpCode(HttpStatus.OK)
  handleDiagnosticComplete(@Body() dto: DiagnosticWebhookDto) {
    return this.aiProxyService.handleDiagnosticComplete(dto);
  }

  // Admin triggers a full re-scrape of MedlinePlus/PubMed on the AI service
  @Post('scraper/refresh')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  triggerScraperRefresh() {
    return this.aiProxyService.triggerScraperRefresh();
  }

  // Doctor uploads 1-5 photos to enroll their face for biometric login.
  // Sets Doctor.faceRegistered = true on success.
  // Must be called with multipart/form-data; field name for files is "photos".
  @Post('face/enroll')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  enrollFace(
    @CurrentUser() user: Profile & { doctor: Doctor | null },
    @Req() req: FastifyRequest,
  ) {
    if (!user.doctor) {
      throw new Error('Doctor record not initialised');
    }
    return this.aiProxyService.enrollFace(user.doctor.id, req);
  }

  // Doctor sends a live photo to verify their face (2FA step after JWT login).
  // Returns { success, similarityScore, antiSpoofPass }.
  // Must be called with multipart/form-data; field name for the file is "photo".
  @Post('face/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  verifyFace(
    @CurrentUser() user: Profile & { doctor: Doctor | null },
    @Req() req: FastifyRequest,
  ) {
    if (!user.doctor) {
      throw new Error('Doctor record not initialised');
    }
    return this.aiProxyService.verifyFace(user.doctor.id, req);
  }
}
