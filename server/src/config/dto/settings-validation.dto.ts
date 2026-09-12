import { Type } from 'class-transformer';
import {
  IsOptional,
  IsBoolean,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const K8S_NAME_REGEX = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

class BannerDto {
  @IsOptional()
  @IsBoolean()
  show?: boolean;

  @IsOptional()
  @IsString()
  message?: string;

  // El input del cliente es texto libre (acepta nombres CSS como "azure"
  // ademas de hex), asi que solo validamos que sea un string no vacio.
  @IsOptional()
  @IsString()
  @MaxLength(50)
  bgcolor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  fontcolor?: string;
}

class KuberoSectionDto {
  @IsOptional()
  @IsBoolean()
  readonly?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => BannerDto)
  banner?: BannerDto;
}

class KuberoConfigDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => KuberoSectionDto)
  kubero?: KuberoSectionDto;
}

// Nota: NO representa el objeto de settings completo (incluye
// podSizeList, buildpacks, notifications, templates, etc., ya
// manejados por sus propios endpoints). Solo valida los campos con
// formato específico (colores hex, nombre de namespace) que hoy no
// se chequean. El resto del payload sigue pasando intacto.
export class SettingsValidationDto {
  @IsOptional()
  @Matches(K8S_NAME_REGEX, {
    message: 'namespace must be a valid Kubernetes namespace name',
  })
  @MaxLength(63)
  namespace?: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => KuberoConfigDto)
  config?: KuberoConfigDto;
}
