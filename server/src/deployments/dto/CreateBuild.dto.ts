import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateBuild {
  @ApiProperty({ enum: ['buildpacks', 'dockerfile', 'nixpacks', 'plain'] })
  @IsIn(['buildpacks', 'dockerfile', 'nixpacks', 'plain'])
  buildstrategy: 'buildpacks' | 'dockerfile' | 'nixpacks' | 'plain';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  repository: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reference: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  dockerfilePath: string;
}
