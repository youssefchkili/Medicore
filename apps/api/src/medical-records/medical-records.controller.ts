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
import { MedicalRecordsService } from './medical-records.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { ReviewDiagnosticDto } from './dto/review-diagnostic.dto';
import { Role } from '../generated/prisma';
import type { Profile } from '../generated/prisma';

@UseGuards(JwtAuthGuard)
@Controller()
export class MedicalRecordsController {
  constructor(private medicalRecordsService: MedicalRecordsService) {}

  // ─── Medical records ───────────────────────────────────────────────────────

  @Get('medical-records')
  getMyRecords(@CurrentUser() user: Profile) {
    return this.medicalRecordsService.getMyRecords(user);
  }

  @Get('medical-records/:id')
  getRecordById(
    @CurrentUser() user: Profile,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.medicalRecordsService.getRecordById(user, id);
  }

  @Post('medical-records')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  createRecord(@CurrentUser() user: Profile, @Body() dto: CreateMedicalRecordDto) {
    return this.medicalRecordsService.create(user, dto);
  }

  // ─── Pre-diagnostics ───────────────────────────────────────────────────────

  @Get('diagnostics')
  getMyDiagnostics(@CurrentUser() user: Profile) {
    return this.medicalRecordsService.getMyDiagnostics(user);
  }

  @Get('diagnostics/:id')
  getDiagnosticById(
    @CurrentUser() user: Profile,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.medicalRecordsService.getDiagnosticById(user, id);
  }

  @Patch('diagnostics/:id/review')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  reviewDiagnostic(
    @CurrentUser() user: Profile,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDiagnosticDto,
  ) {
    return this.medicalRecordsService.reviewDiagnostic(user, id, dto);
  }
}
