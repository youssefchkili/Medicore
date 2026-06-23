import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class SoapNotes {
  @IsString()
  subjective: string;

  @IsString()
  objective: string;

  @IsString()
  assessment: string;

  @IsString()
  plan: string;
}

export class CreateMedicalRecordDto {
  @IsUUID()
  patientId: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsObject()
  soapNotes: SoapNotes;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsObject()
  prescription?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsBoolean()
  isConfidential?: boolean;
}
