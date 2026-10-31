import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsIn,
  IsOptional,
  IsArray,
  IsObject,
  IsNotIn,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RunpackPhaseDto } from '../../config/dto/runpack.dto';

class BuildpackDto {
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

class GitLinkDto {
  @IsOptional()
  @IsObject()
  keys: { priv?: string; pub?: string };

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  repository?: any;

  @IsOptional()
  @IsObject()
  webhook: object;
}

class RegistryDto {
  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

class PipelinePhaseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsBoolean()
  enabled: boolean;

  @IsString()
  context: string;

  @IsString()
  domain: string;

  @IsArray()
  defaultEnvvars: any[];
}

export class CreatePipelineDTO {
  // Misma regla que el formulario: Kubernetes solo acepta minúsculas en los
  // nombres (RFC 1123), y sin esto quien llamaba a la API directamente recibía
  // el error técnico de Kubernetes en vez de un mensaje claro.
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60, {
    message: 'El nombre del pipeline no puede tener más de 60 caracteres',
  })
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message:
      'El nombre del pipeline solo puede tener minúsculas, números y guiones, y debe empezar con una letra o un número',
  })
  @IsNotIn(['new'], {
    message: 'El nombre del pipeline no puede ser "new"',
  })
  pipelineName: string;

  @ApiProperty()
  @IsString()
  domain: string;

  @ApiProperty()
  @IsBoolean()
  reviewapps: boolean;

  @ApiProperty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PipelinePhaseDto)
  phases: PipelinePhaseDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => BuildpackDto)
  buildpack?: BuildpackDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => GitLinkDto)
  git?: GitLinkDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => RegistryDto)
  registry?: RegistryDto;

  @ApiProperty()
  @IsString()
  dockerimage: string;

  @ApiProperty()
  @IsIn(['git', 'docker'])
  deploymentstrategy: 'git' | 'docker';

  @ApiProperty()
  @IsIn(['plain', 'dockerfile', 'nixpacks', 'buildpacks'])
  buildstrategy: 'plain' | 'dockerfile' | 'nixpacks' | 'buildpacks';

  @ApiProperty()
  @IsOptional()
  @IsString()
  resourceVersion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  access?: {
    teams?: string[];
  };
}
