import { IsEnum, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

// id is intentionally removed — it is taken from the verified JWT, not the request body
export class SyncProfileDto {
  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsEnum(Role)
  role: Role;
}
