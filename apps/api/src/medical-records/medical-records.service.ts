import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { ReviewDiagnosticDto } from './dto/review-diagnostic.dto';
import { Role } from '@prisma/client';
import type { Profile } from '@prisma/client';

@Injectable()
export class MedicalRecordsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ─── Medical records ───────────────────────────────────────────────────────

  async getMyRecords(profile: Profile) {
    if (profile.role === Role.PATIENT) {
      const patient = await this.prisma.patient.findUnique({
        where: { profileId: profile.id },
      });
      if (!patient) return [];
      return this.prisma.medicalRecord.findMany({
        where: { patientId: patient.id, isConfidential: false },
        include: { doctor: { include: { profile: true, specialty: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { profileId: profile.id },
    });
    if (!doctor) return [];
    this.audit.log(profile.id, 'RECORD_LIST_READ', 'MedicalRecord');
    return this.prisma.medicalRecord.findMany({
      where: { doctorId: doctor.id },
      include: { patient: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRecordById(profile: Profile, id: string) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        patient: { include: { profile: true } },
        doctor: { include: { profile: true, specialty: true } },
      },
    });
    if (!record) throw new NotFoundException('Record not found');
    this.assertAccess(profile, record);
    this.audit.log(profile.id, 'RECORD_READ', 'MedicalRecord', id);
    return record;
  }

  async create(profile: Profile, dto: CreateMedicalRecordDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { profileId: profile.id },
    });
    if (!doctor) throw new NotFoundException('Doctor record not found');

    // A doctor may only write a record for a patient they actually have an
    // appointment relationship with — otherwise any DOCTOR-role account could
    // create records for an arbitrary patientId in the request body.
    const hasAppointment = await this.prisma.appointment.findFirst({
      where: { doctorId: doctor.id, patientId: dto.patientId },
    });
    if (!hasAppointment) {
      throw new ForbiddenException(
        'No appointment relationship with this patient',
      );
    }

    if (dto.sessionId) {
      const session = await this.prisma.session.findUnique({
        where: { id: dto.sessionId },
      });
      if (
        !session ||
        session.doctorId !== doctor.id ||
        session.patientId !== dto.patientId
      ) {
        throw new ForbiddenException(
          'Session does not belong to this doctor/patient pair',
        );
      }
    }

    const record = await this.prisma.medicalRecord.create({
      data: {
        patientId: dto.patientId,
        sessionId: dto.sessionId,
        doctorId: doctor.id,
        soapNotes: dto.soapNotes as object,
        diagnosis: dto.diagnosis,
        prescription: dto.prescription as object | undefined,
        attachments: dto.attachments ?? [],
        isConfidential: dto.isConfidential ?? false,
      },
      include: {
        patient: { include: { profile: true } },
        doctor: { include: { profile: true, specialty: true } },
      },
    });
    this.audit.log(profile.id, 'RECORD_CREATED', 'MedicalRecord', record.id);
    return record;
  }

  // ─── Pre-diagnostics ───────────────────────────────────────────────────────

  async getMyDiagnostics(profile: Profile, pendingOnly = false) {
    if (profile.role === Role.PATIENT) {
      const patient = await this.prisma.patient.findUnique({
        where: { profileId: profile.id },
      });
      if (!patient) return [];
      return this.prisma.preDiagnostic.findMany({
        where: { patientId: patient.id },
        include: { doctor: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { profileId: profile.id },
    });
    if (!doctor) return [];

    // The frontend loads this list once and opens per-record detail from the
    // already-fetched array (no follow-up GET /diagnostics/:id call), so this
    // list read — not getDiagnosticById — is where a doctor actually accesses
    // patient PHI in the current UI. Log it here rather than only on the
    // rarely-hit single-record endpoint.
    this.audit.log(profile.id, 'DIAGNOSTIC_LIST_READ', 'PreDiagnostic', pendingOnly ? 'pending' : 'reviewed');

    if (pendingOnly) {
      // Urgency first (enum is declared LOW < MEDIUM < HIGH < EMERGENCY, so
      // 'desc' surfaces EMERGENCY/HIGH cases at the top of the queue instead
      // of a plain FIFO list), then newest-first within the same urgency.
      return this.prisma.preDiagnostic.findMany({
        where: { status: 'PENDING_REVIEW' },
        include: { patient: { include: { profile: true } } },
        orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
      });
    }

    return this.prisma.preDiagnostic.findMany({
      where: { reviewedBy: doctor.id },
      include: { patient: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDiagnosticById(profile: Profile, id: string) {
    const diagnostic = await this.prisma.preDiagnostic.findUnique({
      where: { id },
      include: {
        patient: { include: { profile: true } },
        doctor: { include: { profile: true } },
      },
    });
    if (!diagnostic) throw new NotFoundException('Diagnostic not found');

    const patient = await this.prisma.patient.findUnique({
      where: { profileId: profile.id },
    });
    const doctor = await this.prisma.doctor.findUnique({
      where: { profileId: profile.id },
    });
    const isOwner = patient && diagnostic.patientId === patient.id;
    const isReviewer = doctor && diagnostic.reviewedBy === doctor.id;
    // Any doctor may open a still-unclaimed case from the shared pending-review
    // pool (matching the list endpoint's visibility), not just whoever it's
    // eventually assigned to — otherwise a doctor could see a case in their
    // queue but get a 403 opening it before claiming it.
    const isPendingAndDoctor = doctor && diagnostic.status === 'PENDING_REVIEW';
    const isAdmin = profile.role === Role.ADMIN;

    if (!isOwner && !isReviewer && !isPendingAndDoctor && !isAdmin) {
      throw new ForbiddenException();
    }
    this.audit.log(profile.id, 'DIAGNOSTIC_READ', 'PreDiagnostic', id);
    return diagnostic;
  }

  async reviewDiagnostic(profile: Profile, id: string, dto: ReviewDiagnosticDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { profileId: profile.id },
    });
    if (!doctor) throw new NotFoundException('Doctor record not found');

    const diagnostic = await this.prisma.preDiagnostic.findUnique({ where: { id } });
    if (!diagnostic) throw new NotFoundException('Diagnostic not found');

    return this.prisma.preDiagnostic.update({
      where: { id },
      data: {
        status: dto.status,
        doctorNotes: dto.doctorNotes,
        reviewedBy: doctor.id,
      },
    });
  }

  // ─── Helper ────────────────────────────────────────────────────────────────

  private assertAccess(profile: Profile, record: any) {
    const isPatient = record.patient?.profileId === profile.id && !record.isConfidential;
    const isDoctor = record.doctor?.profileId === profile.id;
    const isAdmin = profile.role === Role.ADMIN;
    if (!isPatient && !isDoctor && !isAdmin) throw new ForbiddenException();
  }
}
