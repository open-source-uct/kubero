import { Type } from "class-transformer";
import {
	IsBoolean,
	IsInt,
	IsOptional,
	IsString,
	Matches,
	Max,
	Min,
	ValidateBy,
	ValidateNested,
} from "class-validator";
import { PodSizeResourcesDto } from "../../config/podsize/podsize.dto";

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
	@IsOptional() @IsString() @Matches(/^\//) path?: string;
	@IsOptional() @Type(() => Number) @IsInt() @Min(1) periodSeconds?: number;
	@IsOptional() @Type(() => Number) @IsInt() @Min(1) startupSeconds?: number;
	@IsOptional() @Type(() => Number) @IsInt() @Min(1) timeoutSeconds?: number;
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
const INGRESS_ANNOTATION_KEY_PATTERN =
	/^([a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*\/)?[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$/;

function hasOnlySafeIngressAnnotationKeys(value: unknown): boolean {
	if (value === undefined || value === null) return true;
	if (typeof value !== "object" || Array.isArray(value)) return false;
	return Object.keys(value).every(
		(key) => !key.toLowerCase().includes("snippet") && INGRESS_ANNOTATION_KEY_PATTERN.test(key),
	);
}

class IngressDto {
	@IsOptional()
	@ValidateBy({
		name: "hasOnlySafeIngressAnnotationKeys",
		validator: {
			validate: (value) => hasOnlySafeIngressAnnotationKeys(value),
			defaultMessage: () =>
				"ingress.annotations contiene claves de snippet o con formato no válido",
		},
	})
	annotations?: object;
}

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
	@Type(() => IngressDto)
	ingress?: IngressDto;

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
