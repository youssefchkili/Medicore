import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { ReviewDiagnosticDto } from './dto/review-diagnostic.dto';
import { Role } from '../generated/prisma';
import type { Profile } from '../generated/prisma';

@Injectable()
export class MedicalRecordsService {
  constructor(private prisma: PrismaService) {}

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
    return record;
  }

  async create(profile: Profile, dto: CreateMedicalRecordDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { profileId: profile.id },
    });
    if (!doctor) throw new NotFoundException('Doctor record not found');

    return this.prisma.medicalRecord.create({
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
  }

  // ─── Pre-diagnostics ───────────────────────────────────────────────────────

  async getMyDiagnostics(profile: Profile) {
    if (profile.role === Role.PATIENT) {
      const patient = await this.prisma.patient.findUnique({
        where: { profileId: profile.id },
      });
      if (!patient) return [];
      return this.prisma.preDiagnostic.findMany({
        where: { patientId: patient.id },
        orderBy: { createdAt: 'desc' },
      });
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { profileId: profile.id },
    });
    if (!doctor) return [];
    return this.prisma.preDiagnostic.findMany({
      where: { reviewedBy: doctor.id },
      include: { patient: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDiagnosticById(profile: Profile, id: string) {
    const diagnostic = await this.prisma.preDiagnostic.findUnique({
      where: { id },
      include: { patient: { include: { profile: true } } },
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
    const isAdmin = profile.role === Role.ADMIN;

    if (!isOwner && !isReviewer && !isAdmin) throw new ForbiddenException();
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
