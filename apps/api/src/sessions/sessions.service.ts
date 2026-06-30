import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { EndSessionDto } from './dto/end-session.dto';
import { NotificationType, Role, SessionStatus } from '@prisma/client';
import type { Doctor, Patient, Profile } from '@prisma/client';

type AuthUser = Profile & { doctor: Doctor | null; patient: Patient | null };

@Injectable()
export class SessionsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // Doctor creates a session linked to one of their appointments
  async create(user: AuthUser, dto: CreateSessionDto) {
    if (!user.doctor) throw new ForbiddenException('Only doctors can create sessions');

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.doctorId !== user.doctor.id) {
      throw new ForbiddenException('This appointment does not belong to you');
    }

    return this.prisma.session.create({
      data: {
        appointmentId: dto.appointmentId,
        doctorId: user.doctor.id,
        patientId: appointment.patientId,
        status: SessionStatus.WAITING,
      },
    });
  }

  // Doctor starts the session — sets startedAt, transitions to ACTIVE, notifies patient
  async start(user: AuthUser, sessionId: string) {
    if (!user.doctor) throw new ForbiddenException('Only doctors can start sessions');

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { patient: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.doctorId !== user.doctor.id) throw new ForbiddenException('Not your session');

    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.ACTIVE, startedAt: new Date() },
    });

    // Notify the patient so they know the doctor has joined
    await this.notifications.send({
      recipientId: session.patient.profileId,
      type: NotificationType.SESSION_STARTED,
      title: 'Your session has started',
      body: 'Your doctor is ready. Please join the session.',
      data: { sessionId },
    });

    return updated;
  }

  // Doctor ends the session — sets endedAt, transitions to ENDED, optionally saves SOAP notes
  async end(user: AuthUser, sessionId: string, dto: EndSessionDto) {
    if (!user.doctor) throw new ForbiddenException('Only doctors can end sessions');

    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.doctorId !== user.doctor.id) throw new ForbiddenException('Not your session');

    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.ENDED,
        endedAt: new Date(),
        ...(dto.soapSummary !== undefined && { soapSummary: dto.soapSummary }),
        ...(dto.recordingUrl !== undefined && { recordingUrl: dto.recordingUrl }),
      },
      include: { emotionSnapshots: { orderBy: { timestamp: 'asc' } } },
    });
  }

  // Get a single session — doctor and patient of that session can access it.
  // Emotion snapshots are only returned to the doctor (never to the patient).
  async findById(user: AuthUser, sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        emotionSnapshots: { orderBy: { timestamp: 'asc' } },
        medicalRecord: true,
      },
    });
    if (!session) throw new NotFoundException('Session not found');

    const isDoctor = user.doctor && session.doctorId === user.doctor.id;
    const isPatient = user.patient && session.patientId === user.patient.id;
    const isAdmin = user.role === Role.ADMIN;

    if (!isDoctor && !isPatient && !isAdmin) throw new ForbiddenException();

    // Strip emotion data before returning to patient
    if (isPatient && !isDoctor && !isAdmin) {
      const { emotionSnapshots: _stripped, ...rest } = session;
      return rest;
    }

    return session;
  }

  // List sessions for the current user — doctors see their own, patients see their own
  async findMy(user: AuthUser) {
    if (user.doctor) {
      return this.prisma.session.findMany({
        where: { doctorId: user.doctor.id },
        orderBy: { startedAt: 'desc' },
        take: 20,
        include: { patient: { include: { profile: true } } },
      });
    }
    if (user.patient) {
      return this.prisma.session.findMany({
        where: { patientId: user.patient.id },
        orderBy: { startedAt: 'desc' },
        take: 20,
      });
    }
    return [];
  }
}
