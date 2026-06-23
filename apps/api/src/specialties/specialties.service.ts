import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';

@Injectable()
export class SpecialtiesService {
  constructor(private prisma: PrismaService) {}

  findAll(activeOnly = true) {
    return this.prisma.specialty.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const specialty = await this.prisma.specialty.findUnique({
      where: { slug },
      include: {
        doctors: {
          where: { isAvailable: true, profile: { isActive: true } },
          include: { profile: true },
          take: 10,
        },
      },
    });
    if (!specialty) throw new NotFoundException(`Specialty "${slug}" not found`);
    return specialty;
  }

  async create(dto: CreateSpecialtyDto) {
    const existing = await this.prisma.specialty.findFirst({
      where: { OR: [{ name: dto.name }, { slug: dto.slug }] },
    });
    if (existing) throw new ConflictException('Specialty name or slug already exists');

    return this.prisma.specialty.create({ data: dto });
  }

  async update(id: string, dto: UpdateSpecialtyDto) {
    await this.findById(id);
    return this.prisma.specialty.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findById(id);
    // Soft delete — keeps existing doctor relations intact
    return this.prisma.specialty.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async findById(id: string) {
    const specialty = await this.prisma.specialty.findUnique({ where: { id } });
    if (!specialty) throw new NotFoundException('Specialty not found');
    return specialty;
  }
}
