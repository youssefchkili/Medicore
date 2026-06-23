import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import type { Profile } from '../generated/prisma';
import { Role } from '../generated/prisma';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: Profile) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: Profile, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Patch('me/patient')
  @UseGuards(RolesGuard)
  @Roles(Role.PATIENT)
  updatePatient(@CurrentUser() user: Profile, @Body() dto: UpdatePatientDto) {
    return this.usersService.updatePatient(user.id, dto);
  }

  @Patch('me/doctor')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  updateDoctor(@CurrentUser() user: Profile, @Body() dto: UpdateDoctorDto) {
    return this.usersService.updateDoctor(user.id, dto);
  }

  // ─── Doctor listing (public within authenticated app) ───────────────────────

  @Get('doctors')
  getDoctors(
    @Query('specialty') specialty?: string,
    @Query('available') available?: string,
  ) {
    const availableBool =
      available === 'true' ? true : available === 'false' ? false : undefined;
    return this.usersService.getDoctors(specialty, availableBool);
  }

  @Get('doctors/:id')
  getDoctorById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getDoctorById(id);
  }

  // ─── Sub-profile provisioning (called after sync-profile) ───────────────────

  @Post('me/patient/init')
  @UseGuards(RolesGuard)
  @Roles(Role.PATIENT)
  initPatient(@CurrentUser() user: Profile) {
    return this.usersService.ensurePatientRecord(user.id);
  }
}
