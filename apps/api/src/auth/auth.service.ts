import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncProfileDto } from './dto/sync-profile.dto';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async syncProfile(userId: string, dto: SyncProfileDto) {
    // Doctors start inactive — they must be approved by an admin before accessing the platform
    const profile = await this.prisma.profile.upsert({
      where: { id: userId },
      create: {
        id: userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        isActive: dto.role !== Role.DOCTOR,
      },
      update: {}, // Never overwrite existing profile fields on re-sync
    });

    // Create the Doctor record on first sync when the doctor provides their details
    if (dto.role === Role.DOCTOR && dto.specialty && dto.licenseNumber) {
      const slug = dto.specialty
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      const specialty = await this.prisma.specialty.upsert({
        where: { slug },
        create: { name: dto.specialty, slug },
        update: {},
      });

      const existingDoctor = await this.prisma.doctor.findUnique({
        where: { profileId: userId },
      });

      if (!existingDoctor) {
        await this.prisma.doctor
          .create({
            data: {
              profileId: userId,
              specialtyId: specialty.id,
              licenseNumber: dto.licenseNumber,
            },
          })
          .catch(() => {}); // Silently ignore duplicate license-number violations
      }
    }

    return profile;
  }
}
