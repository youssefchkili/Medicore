import { IsOptional, IsUUID } from 'class-validator';

export class StartChatDto {
  @IsOptional()
  @IsUUID()
  preDiagnosticId?: string;
}
