import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  ValidateNested,
  ValidationError,
} from 'class-validator';
import { PodSizeResourcesDto } from '../../config/podsize/podsize.dto';

// class-validator nests errors for fields inside nested objects (e.g.
// podsize.resources.requests.cpu) under `error.children` instead of putting
// them on `error.constraints` directly. Flatten recursively so none of the
// nested messages get silently dropped.
export function flattenValidationErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }
    if (error.children && error.children.length > 0) {
      messages.push(...flattenValidationErrors(error.children));
    }
  }
  return messages;
}

class AppPodSizeDto {
  @IsOptional() @IsString() id?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() default?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PodSizeResourcesDto)
  resources?: PodSizeResourcesDto;
}

class AutoscalingLimitsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minReplicas?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxReplicas?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  targetCPUUtilizationPercentage?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  targetMemoryUtilizationPercentage?: number;
}

class ScalableComponentDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AutoscalingLimitsDto)
  autoscaling?: AutoscalingLimitsDto;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) replicaCount?: number;
}

class HealthcheckDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() path?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) periodSeconds?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) startupSeconds?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) timeoutSeconds?: number;
}

class ServiceDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @IsString() type?: string;
}

class ImageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  containerPort?: number;
}

// Nota: esto NO representa el objeto App completo (tiene 137 campos).
// Solo valida los campos numéricos/de cantidad que hoy no se chequean.
// El resto del payload sigue pasando intacto hacia appsService, sin tocar.
export class AppValidationDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AppPodSizeDto)
  podsize?: AppPodSizeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PodSizeResourcesDto)
  resources?: PodSizeResourcesDto;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) replicaCount?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceDto)
  service?: ServiceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => HealthcheckDto)
  healthcheck?: HealthcheckDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImageDto)
  image?: ImageDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScalableComponentDto)
  web?: ScalableComponentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScalableComponentDto)
  worker?: ScalableComponentDto;
}
