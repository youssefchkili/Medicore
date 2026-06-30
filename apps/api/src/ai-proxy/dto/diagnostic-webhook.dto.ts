import { IsEnum, IsUUID } from 'class-validator';
import { Urgency } from '@prisma/client';

export class DiagnosticWebhookDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  preDiagnosticId: string;

  @IsEnum(Urgency)
  urgency: Urgency;
}
