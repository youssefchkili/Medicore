import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

// Only self-registerable roles — ADMIN accounts must be created directly in the
// database by a trusted operator, never through client-supplied signup data.
export const SELF_REGISTERABLE_ROLES = [Role.PATIENT, Role.DOCTOR] as const;
export type SelfRegisterableRole = (typeof SELF_REGISTERABLE_ROLES)[number];

// id is intentionally removed — it is taken from the verified JWT, not the request body
export class SyncProfileDto {
  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsIn(SELF_REGISTERABLE_ROLES)
  role: SelfRegisterableRole;

  // Doctor-only fields — used to create the Doctor record on first sync
  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;
}
