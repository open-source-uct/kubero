import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsInt,
  ValidateNested,
  IsIn,
} from 'class-validator';

const RESOURCE_TYPES = [
  'user',
  'team',
  'role',
  'app',
  'pipeline',
  'namespace',
  'phase',
  'unknown',
  'system',
  'build',
  'addon',
  'settings',
  'events',
  // ya no lo usa ningún endpoint (se quitó el escaneo de vulnerabilidades), pero
  // se sigue aceptando: roles antiguos lo tienen y un cliente viejo lo reenvía
  'security',
  'templates',
  'config',
  'addons',
  'logs',
  'console',
  'reboot',
  'audit',
  'token',
];

class PermissionDto {
  @IsIn(RESOURCE_TYPES)
  resource: string;

  @IsString()
  @IsNotEmpty()
  action: string;
}

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  scopeToOwnTeam?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions: PermissionDto[];
}

export class UpdateRoleDto extends CreateRoleDto {}
