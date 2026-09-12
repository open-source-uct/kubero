import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsIn,
  IsOptional,
  IsArray,
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

  @IsString()
  @IsNotEmpty()
  tag: string;
}

class GitLinkDto {
  keys: { priv?: string; pub?: string };

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  repository?: any;

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
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
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

  @ApiProperty()
  @ValidateNested()
  @Type(() => BuildpackDto)
  buildpack: BuildpackDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => GitLinkDto)
  git: GitLinkDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => RegistryDto)
  registry: RegistryDto;

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
