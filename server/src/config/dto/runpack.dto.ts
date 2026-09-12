import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  ValidateNested,
} from 'class-validator';

export class CapabilitiesDto {
  @IsArray()
  @IsString({ each: true })
  add: string[];

  @IsArray()
  @IsString({ each: true })
  drop: string[];
}

export class SecurityContextDto {
  @IsBoolean()
  readOnlyRootFilesystem: boolean;

  @IsBoolean()
  allowPrivilegeEscalation: boolean;

  @IsInt()
  runAsUser: number;

  @IsInt()
  runAsGroup: number;

  @IsBoolean()
  runAsNonRoot: boolean;

  @ValidateNested()
  @Type(() => CapabilitiesDto)
  capabilities: CapabilitiesDto;
}

export class RunpackPhaseDto {
  @IsString()
  @IsNotEmpty()
  repository: string;

  @IsString()
  @IsNotEmpty()
  tag: string;

  @IsOptional()
  @IsString()
  command?: string;

  @IsBoolean()
  readOnlyAppStorage: boolean;

  @ValidateNested()
  @Type(() => SecurityContextDto)
  securityContext: SecurityContextDto;
}

export class CreateRunpackDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  language: string;

  @ValidateNested()
  @Type(() => RunpackPhaseDto)
  fetch: RunpackPhaseDto;

  @ValidateNested()
  @Type(() => RunpackPhaseDto)
  build: RunpackPhaseDto;

  @ValidateNested()
  @Type(() => RunpackPhaseDto)
  run: RunpackPhaseDto;

  @IsOptional()
  @IsString()
  tag?: string;
}
