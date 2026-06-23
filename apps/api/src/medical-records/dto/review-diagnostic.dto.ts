import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DiagnosticStatus } from '../../generated/prisma';

export class ReviewDiagnosticDto {
  @IsEnum(DiagnosticStatus)
  status: DiagnosticStatus;

  @IsOptional()
  @IsString()
  doctorNotes?: string;
}
