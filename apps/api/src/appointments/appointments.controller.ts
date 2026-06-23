import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { CreateSlotDto } from './dto/create-slot.dto';
import { Role } from '../generated/prisma';
import type { Profile } from '../generated/prisma';

@UseGuards(JwtAuthGuard)
@Controller()
export class AppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  // ─── Availability slots ────────────────────────────────────────────────────

  @Get('availability/:doctorId')
  getAvailableSlots(@Param('doctorId', ParseUUIDPipe) doctorId: string) {
    return this.appointmentsService.getAvailableSlots(doctorId);
  }

  @Post('availability')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  createSlot(@CurrentUser() user: Profile, @Body() dto: CreateSlotDto) {
    return this.appointmentsService.createSlot(user, dto);
  }

  @Delete('availability/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  deleteSlot(
    @CurrentUser() user: Profile,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.appointmentsService.deleteSlot(user, id);
  }

  // ─── Appointments ──────────────────────────────────────────────────────────

  @Get('appointments')
  getMyAppointments(@CurrentUser() user: Profile) {
    return this.appointmentsService.getMyAppointments(user);
  }

  @Get('appointments/:id')
  getAppointmentById(
    @CurrentUser() user: Profile,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.appointmentsService.getAppointmentById(user, id);
  }

  @Post('appointments')
  @UseGuards(RolesGuard)
  @Roles(Role.PATIENT)
  book(@CurrentUser() user: Profile, @Body() dto: BookAppointmentDto) {
    return this.appointmentsService.book(user, dto);
  }

  @Patch('appointments/:id/cancel')
  cancel(
    @CurrentUser() user: Profile,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointmentsService.cancel(user, id, dto);
  }

  @Patch('appointments/:id/confirm')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  confirm(
    @CurrentUser() user: Profile,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.appointmentsService.confirm(user, id);
  }
}
