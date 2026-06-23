import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncProfileDto } from './dto/sync-profile.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async syncProfile(userId: string, dto: SyncProfileDto) {
    return this.prisma.profile.upsert({
      where: { id: userId },
      create: {
        id: userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
      },
      // Don't overwrite fields if the profile already exists
      update: {},
    });
  }
}
