import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

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
    });
    if (!profile) throw new NotFoundException('User not found');

    const updated = await this.prisma.profile.update({
      where: { id: targetId },
      data: { isActive: !profile.isActive },
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

  async approveDoctor(actorId: string, profileId: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { profileId },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'DOCTOR_APPROVED',
        resourceType: 'Doctor',
        resourceId: doctor.id,
      },
    });

    return this.prisma.profile.update({
      where: { id: profileId },
      data: { isActive: true },
      include: { doctor: true },
    });
  }

  // ─── Audit logs ────────────────────────────────────────────────────────────

  getAuditLogs(limit = 100) {
    return this.prisma.auditLog.findMany({
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  async getStats() {
    const [patients, doctors, appointments, diagnostics] = await Promise.all([
      this.prisma.patient.count(),
      this.prisma.doctor.count(),
      this.prisma.appointment.count(),
      this.prisma.preDiagnostic.count(),
    ]);
    return { patients, doctors, appointments, diagnostics };
  }
}
