import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ─── Stats ─────────────────────────────────────────────────────────────────

  async getStats() {
    const [patients, doctors, pendingDoctors, appointments, diagnostics] =
      await Promise.all([
        this.prisma.patient.count(),
        this.prisma.doctor.count({ where: { status: 'ACTIVE' } }),
        this.prisma.doctor.count({ where: { status: 'PENDING' } }),
        this.prisma.appointment.count(),
        this.prisma.preDiagnostic.count(),
      ]);
    return { patients, doctors, pendingDoctors, appointments, diagnostics };
  }

  // ─── User management ───────────────────────────────────────────────────────

  getUsers(role?: string) {
    return this.prisma.profile.findMany({
      where: role ? { role: role as any } : undefined,
      include: { doctor: { include: { specialty: true } }, patient: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async toggleUser(actorId: string, targetId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: targetId },
      include: { doctor: true },
    });
    if (!profile) throw new NotFoundException('User not found');

    const newIsActive = !profile.isActive;

    if (profile.role === 'DOCTOR' && profile.doctor) {
      if (profile.doctor.status === 'PENDING') {
        throw new BadRequestException(
          'This doctor has not been approved yet — use the approve endpoint instead',
        );
      }
      await this.prisma.doctor.update({
        where: { profileId: targetId },
        data: { status: newIsActive ? 'ACTIVE' : 'DEACTIVATED' },
      });
    }

    const updated = await this.prisma.profile.update({
      where: { id: targetId },
      data: { isActive: newIsActive },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: updated.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        resourceType: 'Profile',
        resourceId: targetId,
      },
    });

    return updated;
  }

  // ─── Doctor approval ───────────────────────────────────────────────────────

  getPendingDoctors() {
    return this.prisma.profile.findMany({
      where: { role: 'DOCTOR', doctor: { status: 'PENDING' } },
      include: { doctor: { include: { specialty: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveDoctor(actorId: string, profileId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: { doctor: true },
    });
    if (!profile || (profile.role as string) !== 'DOCTOR' || !profile.doctor) {
      throw new NotFoundException('Doctor profile not found');
    }

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'DOCTOR_APPROVED',
        resourceType: 'Doctor',
        resourceId: profileId,
      },
    });

    const [, updatedProfile] = await this.prisma.$transaction([
      this.prisma.doctor.update({
        where: { profileId },
        data: { status: 'ACTIVE' },
      }),
      this.prisma.profile.update({
        where: { id: profileId },
        data: { isActive: true },
        include: { doctor: { include: { specialty: true } } },
      }),
    ]);

    return updatedProfile;
  }

  // ─── Appointments ──────────────────────────────────────────────────────────

  getAllAppointments(limit = 50) {
    return this.prisma.appointment.findMany({
      include: {
        patient: { include: { profile: true } },
        doctor: { include: { profile: true, specialty: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: limit,
    });
  }

  // ─── Audit logs ────────────────────────────────────────────────────────────

  getAuditLogs(limit = 100) {
    return this.prisma.auditLog.findMany({
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
