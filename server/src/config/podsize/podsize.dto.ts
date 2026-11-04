import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import {
  IsK8sQuantity,
  parseK8sQuantity,
} from '../../common/validators/k8s-quantity.validator';

// Kubernetes rechaza un contenedor cuya reserva (request) supera su límite: un
// tamaño así haría fallar cada app que lo use
export function assertRequestsWithinLimits(resources: PodSizeResourcesDto) {
  for (const key of ['cpu', 'memory'] as const) {
    const request = parseK8sQuantity(resources?.requests?.[key]);
    const limit = parseK8sQuantity(resources?.limits?.[key]);
    if (request !== null && limit !== null && request > limit) {
      throw new BadRequestException(
        `${key}: la reserva (${resources.requests[key]}) no puede superar el límite (${resources.limits[key]})`,
      );
    }
  }
}

export class ResourceQuantitiesDto {
  @IsK8sQuantity()
  cpu: string;

  @IsK8sQuantity()
  memory: string;
}

export class PodSizeResourcesDto {
  @ValidateNested()
  @Type(() => ResourceQuantitiesDto)
  requests: ResourceQuantitiesDto;

  @ValidateNested()
  @Type(() => ResourceQuantitiesDto)
  limits: ResourceQuantitiesDto;
}

export class CreatePodSizeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsBoolean()
  default?: boolean;

  @ValidateNested()
  @Type(() => PodSizeResourcesDto)
  resources: PodSizeResourcesDto;
}

export class UpdatePodSizeDto extends CreatePodSizeDto {}
