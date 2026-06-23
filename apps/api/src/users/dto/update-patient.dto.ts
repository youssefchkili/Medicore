import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { BloodType } from '../../generated/prisma';

export class UpdatePatientDto {
  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chronicConditions?: string[];

  @IsOptional()
  @IsObject()
  emergencyContact?: Record<string, string>;

  @IsOptional()
  @IsObject()
  insuranceInfo?: Record<string, string>;
}
