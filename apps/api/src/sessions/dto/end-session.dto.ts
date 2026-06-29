import { IsObject, IsOptional, IsString } from 'class-validator';

export class EndSessionDto {
  @IsOptional()
  @IsObject()
  soapSummary?: Record<string, string>;

  @IsOptional()
  @IsString()
  recordingUrl?: string;
}
