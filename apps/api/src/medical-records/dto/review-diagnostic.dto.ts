import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DiagnosticStatus } from '@prisma/client';

export class ReviewDiagnosticDto {
  @IsEnum(DiagnosticStatus)
  status: DiagnosticStatus;

  @IsOptional()
  @IsString()
  doctorNotes?: string;
}
