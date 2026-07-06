import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { CreateSlotDto } from './dto/create-slot.dto';
import { AppointmentStatus, NotificationType, Role } from '@prisma/client';
import type { Profile } from '@prisma/client';

const APPOINTMENT_INCLUDE = {
  patient: { include: { profile: true } },
  doctor: { include: { profile: true, specialty: true } },
  slot: true,
  preDiagnostic: true,
} as const;

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ─── Availability slots ────────────────────────────────────────────────────

  async getMySlots(profile: Profile) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { profileId: profile.id },
    });
    if (!doctor) return [];
    return this.prisma.availabilitySlot.findMany({
      where: { doctorId: doctor.id, startTime: { gte: new Date() } },
      orderBy: { startTime: 'asc' },
    });
  }

  async getAvailableSlots(doctorId: string) {
    return this.prisma.availabilitySlot.findMany({
      where: {
        doctorId,
        isBooked: false,
        startTime: { gte: new Date() },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async createSlot(profile: Profile, dto: CreateSlotDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { profileId: profile.id },
    });
    if (!doctor) throw new NotFoundException('Doctor record not found');

    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    if (start <= new Date()) throw new BadRequestException('startTime must be in the future');
    if (end <= start) throw new BadRequestException('endTime must be after startTime');

    return this.prisma.availabilitySlot.create({
      data: {
        doctorId: doctor.id,
        startTime: start,
        endTime: end,
        isRecurring: dto.isRecurring ?? false,
        recurrenceRule: dto.recurrenceRule,
      },
    });
  }

  async deleteSlot(profile: Profile, slotId: string) {
    const slot = await this.prisma.availabilitySlot.findUnique({
      where: { id: slotId },
      include: { doctor: true },
    });
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.doctor.profileId !== profile.id) throw new ForbiddenException();
    if (slot.isBooked) throw new BadRequestException('Cannot delete a booked slot');

    return this.prisma.availabilitySlot.delete({ where: { id: slotId } });
  }

  // ─── Appointments ──────────────────────────────────────────────────────────

  async getMyAppointments(profile: Profile) {
    if (profile.role === Role.PATIENT) {
      const patient = await this.prisma.patient.findUnique({
        where: { profileId: profile.id },
      });
      if (!patient) return [];
      return this.prisma.appointment.findMany({
        where: { patientId: patient.id },
        include: APPOINTMENT_INCLUDE,
        orderBy: { scheduledAt: 'desc' },
      });
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { profileId: profile.id },
    });
    if (!doctor) return [];
    return this.prisma.appointment.findMany({
      where: { doctorId: doctor.id },
      include: APPOINTMENT_INCLUDE,
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async getAppointmentById(profile: Profile, id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: APPOINTMENT_INCLUDE,
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    this.assertParticipant(profile, appointment);
    return appointment;
  }

  async book(profile: Profile, dto: BookAppointmentDto) {
    const patient = await this.prisma.patient.findUnique({
      where: { profileId: profile.id },
    });
    if (!patient) throw new NotFoundException('Patient record not found');

    // Use a transaction to prevent double-booking
    const appointment = await this.prisma.$transaction(async (tx) => {
      const slot = await tx.availabilitySlot.findUnique({
        where: { id: dto.slotId },
      });
      if (!slot) throw new NotFoundException('Slot not found');
      if (slot.isBooked) throw new BadRequestException('This slot is already booked');
      if (slot.doctorId !== dto.doctorId)
        throw new BadRequestException('Slot does not belong to this doctor');
      if (slot.startTime < new Date())
        throw new BadRequestException('Cannot book a slot in the past');

      await tx.availabilitySlot.update({
        where: { id: slot.id },
        data: { isBooked: true },
      });

      return tx.appointment.create({
        data: {
          patientId: patient.id,
          doctorId: dto.doctorId,
          slotId: slot.id,
          scheduledAt: slot.startTime,
          durationMinutes: dto.durationMinutes ?? 30,
          type: dto.type ?? 'ONLINE',
          notes: dto.notes,
          preDiagnosticId: dto.preDiagnosticId,
          status: 'SCHEDULED',
        },
        include: APPOINTMENT_INCLUDE,
      });
    });

    const patientName = `${appointment.patient.profile.firstName} ${appointment.patient.profile.lastName}`;
    const date = new Date(appointment.scheduledAt).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    this.notifications.send({
      recipientId: appointment.doctor.profile.id,
      type: NotificationType.APPOINTMENT_BOOKED,
      title: 'New appointment booked',
      body: `${patientName} has booked an appointment with you on ${date}.`,
      data: { appointmentId: appointment.id },
    }).catch((err) => this.logger.error('Failed to send APPOINTMENT_BOOKED notification', err));

    return appointment;
  }

  async cancel(profile: Profile, id: string, dto: CancelAppointmentDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        slot: true,
        patient: { include: { profile: true } },
        doctor: { include: { profile: true } },
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    this.assertParticipant(profile, appointment);

    if (
      appointment.status === AppointmentStatus.COMPLETED ||
      appointment.status === AppointmentStatus.CANCELLED
    ) {
      throw new BadRequestException(`Cannot cancel a ${appointment.status.toLowerCase()} appointment`);
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      await tx.availabilitySlot.update({
        where: { id: appointment.slotId },
        data: { isBooked: false },
      });
      return tx.appointment.update({
        where: { id },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancelledReason: dto.reason,
        },
        include: APPOINTMENT_INCLUDE,
      });
    });

    const date = new Date(appointment.scheduledAt).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    if (profile.role === Role.PATIENT) {
      const patientName = `${appointment.patient.profile.firstName} ${appointment.patient.profile.lastName}`;
      this.notifications.send({
        recipientId: appointment.doctor.profile.id,
        type: NotificationType.APPOINTMENT_CANCELLED,
        title: 'Appointment cancelled by patient',
        body: `${patientName} cancelled their appointment scheduled for ${date}.`,
        data: { appointmentId: id },
      }).catch((err) => this.logger.error('Failed to send APPOINTMENT_CANCELLED (doctor) notification', err));
    } else {
      const doctorName = `Dr. ${appointment.doctor.profile.firstName} ${appointment.doctor.profile.lastName}`;
      this.notifications.send({
        recipientId: appointment.patient.profile.id,
        type: NotificationType.APPOINTMENT_CANCELLED,
        title: 'Appointment cancelled',
        body: `${doctorName} cancelled your appointment scheduled for ${date}.`,
        data: { appointmentId: id },
      }).catch((err) => this.logger.error('Failed to send APPOINTMENT_CANCELLED (patient) notification', err));
    }

    return cancelled;
  }

  async confirm(profile: Profile, id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        doctor: { include: { profile: true } },
        patient: { include: { profile: true } },
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.doctor.profileId !== profile.id) throw new ForbiddenException();
    if (appointment.status !== AppointmentStatus.SCHEDULED)
      throw new BadRequestException('Only scheduled appointments can be confirmed');

    const videoRoomUrl =
      appointment.type === 'ONLINE' ? `https://meet.jit.si/medicore-${id}` : null;

    const confirmed = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CONFIRMED, videoRoomUrl },
      include: APPOINTMENT_INCLUDE,
    });

    const doctorName = `Dr. ${appointment.doctor.profile.firstName} ${appointment.doctor.profile.lastName}`;
    const date = new Date(appointment.scheduledAt).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    const extra = videoRoomUrl ? ' Your meeting link is ready.' : '';
    this.notifications.send({
      recipientId: appointment.patient.profile.id,
      type: NotificationType.APPOINTMENT_CONFIRMED,
      title: 'Appointment confirmed',
      body: `${doctorName} confirmed your appointment on ${date}.${extra}`,
      data: { appointmentId: id, videoRoomUrl },
    }).catch((err) => this.logger.error('Failed to send APPOINTMENT_CONFIRMED notification', err));

    return confirmed;
  }

  // ─── Helper ────────────────────────────────────────────────────────────────

  private assertParticipant(profile: Profile, appointment: any) {
    const isPatient = appointment.patient?.profileId === profile.id;
    const isDoctor = appointment.doctor?.profileId === profile.id;
    const isAdmin = profile.role === Role.ADMIN;
    if (!isPatient && !isDoctor && !isAdmin) throw new ForbiddenException();
  }
}
