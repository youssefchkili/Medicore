import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

interface SendNotificationOptions {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sendEmail?: boolean;
  emailTo?: string;
}

@Injectable()
export class NotificationsService {
  private resend: Resend;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.resend = new Resend(this.config.get('RESEND_API_KEY'));
  }

  async send(opts: SendNotificationOptions) {
    const notification = await this.prisma.notification.create({
      data: {
        recipientId: opts.recipientId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        data: (opts.data ?? {}) as object,
        sentViaEmail: opts.sendEmail ?? false,
      },
    });

    if (opts.sendEmail && opts.emailTo) {
      try {
        await this.resend.emails.send({
          from: 'MediCore <noreply@medicore.app>',
          to: opts.emailTo,
          subject: opts.title,
          html: `<p>${opts.body}</p>`,
        });
      } catch (err) {
        // Email failure is non-fatal — the in-app notification is already saved
        console.error('Resend email failed:', err);
      }
    }

    return notification;
  }

  async getMyNotifications(profileId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        recipientId: profileId,
        ...(unreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(profileId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.recipientId !== profileId)
      throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(profileId: string) {
    return this.prisma.notification.updateMany({
      where: { recipientId: profileId, isRead: false },
      data: { isRead: true },
    });
  }
}
