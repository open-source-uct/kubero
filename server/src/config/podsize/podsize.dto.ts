import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { IsK8sQuantity } from '../../common/validators/k8s-quantity.validator';

class ResourceQuantitiesDto {
  @IsK8sQuantity()
  cpu: string;

  @IsK8sQuantity()
  memory: string;
}

class PodSizeResourcesDto {
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
