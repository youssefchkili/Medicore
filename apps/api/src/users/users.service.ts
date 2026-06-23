import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { Role } from '../generated/prisma';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getMe(profileId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        patient: true,
        doctor: {
          include: { specialty: true },
        },
      },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async updateMe(profileId: string, dto: UpdateProfileDto) {
    return this.prisma.profile.update({
      where: { id: profileId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
      include: {
        patient: true,
        doctor: { include: { specialty: true } },
      },
    });
  }

  async updatePatient(profileId: string, dto: UpdatePatientDto) {
    const patient = await this.prisma.patient.findUnique({
      where: { profileId },
    });
    if (!patient) throw new NotFoundException('Patient record not found');

    return this.prisma.patient.update({
      where: { profileId },
      data: {
        ...(dto.bloodType && { bloodType: dto.bloodType }),
        ...(dto.allergies && { allergies: dto.allergies }),
        ...(dto.chronicConditions && { chronicConditions: dto.chronicConditions }),
        ...(dto.emergencyContact !== undefined && { emergencyContact: dto.emergencyContact }),
        ...(dto.insuranceInfo !== undefined && { insuranceInfo: dto.insuranceInfo }),
      },
    });
  }

  async updateDoctor(profileId: string, dto: UpdateDoctorDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { profileId },
    });
    if (!doctor) throw new NotFoundException('Doctor record not found');

    return this.prisma.doctor.update({
      where: { profileId },
      data: {
        ...(dto.specialtyId && { specialtyId: dto.specialtyId }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.yearsExperience !== undefined && { yearsExperience: dto.yearsExperience }),
        ...(dto.consultationFee !== undefined && { consultationFee: dto.consultationFee }),
        ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
      },
      include: { specialty: true },
    });
  }

  async getDoctors(specialtySlug?: string, available?: boolean) {
    return this.prisma.doctor.findMany({
      where: {
        ...(available !== undefined && { isAvailable: available }),
        ...(specialtySlug && {
          specialty: { slug: specialtySlug },
        }),
        profile: { isActive: true },
      },
      include: {
        profile: true,
        specialty: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getDoctorById(id: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      include: {
        profile: true,
        specialty: true,
        availabilitySlots: {
          where: {
            isBooked: false,
            startTime: { gte: new Date() },
          },
          orderBy: { startTime: 'asc' },
          take: 20,
        },
      },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    return doctor;
  }

  async ensurePatientRecord(profileId: string) {
    return this.prisma.patient.upsert({
      where: { profileId },
      create: { profileId },
      update: {},
    });
  }

  async ensureDoctorRecord(profileId: string, licenseNumber: string, specialtyId: string) {
    return this.prisma.doctor.upsert({
      where: { profileId },
      create: { profileId, licenseNumber, specialtyId },
      update: {},
      include: { specialty: true },
    });
  }
}
