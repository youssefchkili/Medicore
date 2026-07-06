import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { AppointmentStatus, AppointmentType, NotificationType } from '@prisma/client';

@Injectable()
export class ReminderCron {
  private readonly logger = new Logger(ReminderCron.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // Runs every minute — finds CONFIRMED ONLINE appointments starting in 10-15 min
  // and sends one reminder to both participants (idempotent: skips if already sent).
  @Cron('* * * * *')
  async sendSessionReminders() {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 10 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 15 * 60 * 1000);

    const upcoming = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.CONFIRMED,
        type: AppointmentType.ONLINE,
        scheduledAt: { gte: windowStart, lte: windowEnd },
      },
      include: {
        patient: { include: { profile: true } },
        doctor: { include: { profile: true } },
      },
    });

    for (const appt of upcoming) {
      // Skip if a reminder was already sent for this appointment
      const alreadySent = await this.prisma.notification.findFirst({
        where: {
          type: NotificationType.APPOINTMENT_REMINDER,
          data: { path: ['appointmentId'], equals: appt.id },
        },
      });
      if (alreadySent) continue;

      const time = new Date(appt.scheduledAt).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit',
      });
      const doctorName = `Dr. ${appt.doctor.profile.firstName} ${appt.doctor.profile.lastName}`;
      const patientName = `${appt.patient.profile.firstName} ${appt.patient.profile.lastName}`;

      await this.notifications.send({
        recipientId: appt.patient.profile.id,
        type: NotificationType.APPOINTMENT_REMINDER,
        title: 'Your session starts in 10 minutes',
        body: `Your online session with ${doctorName} begins at ${time}. Click Join when ready.`,
        data: { appointmentId: appt.id, videoRoomUrl: appt.videoRoomUrl },
      });

      await this.notifications.send({
        recipientId: appt.doctor.profile.id,
        type: NotificationType.APPOINTMENT_REMINDER,
        title: 'Session starts in 10 minutes',
        body: `Your online session with ${patientName} begins at ${time}. Get ready to start.`,
        data: { appointmentId: appt.id, videoRoomUrl: appt.videoRoomUrl },
      });

      this.logger.log(`Sent reminders for appointment ${appt.id}`);
    }
  }
}
