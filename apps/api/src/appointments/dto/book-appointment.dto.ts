import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { AppointmentType } from '../../generated/prisma';

export class BookAppointmentDto {
  @IsUUID()
  doctorId: string;

  @IsUUID()
  slotId: string;

  @IsOptional()
  @IsUUID()
  preDiagnosticId?: string;

  @IsOptional()
  @IsEnum(AppointmentType)
  type?: AppointmentType;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
