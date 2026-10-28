import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Matches,
  Min,
  Max,
  ValidateBy,
  ValidateNested,
} from 'class-validator';
import { PodSizeResourcesDto } from '../../config/podsize/podsize.dto';

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
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).every(
    (key) =>
      !key.toLowerCase().includes('snippet') &&
      INGRESS_ANNOTATION_KEY_PATTERN.test(key),
  );
}

// Variables que el chart kuberoapp del operador ya define en los contenedores
// de la app (PROC_TYPE, PORT) o en el de clonado/build (GIT_*, KUBERO_*), a
// los que también suma las del usuario. Un nombre repetido no impide crear el
// Deployment, pero toda actualización posterior falla ("The order in patch
// list ... doesn't match $setElementOrder") y el operador la reintenta en
// bucle sin fin, consumiendo su CPU.
export const RESERVED_ENV_VARS = [
  'PORT',
  'PROC_TYPE',
  'GIT_REPOSITORY',
  'GIT_BRANCH',
  'GIT_REF',
  'KUBERO_BUILDPACK_DEFAULT_BUILD_CMD',
  'KUBERO_BUILDPACK_DEFAULT_RUN_CMD',
];

export function envVarProblems(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return ['envVars debe ser una lista'];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const envVar of value) {
    const name = envVar?.name;
    if (typeof name !== 'string') continue;
    if (RESERVED_ENV_VARS.includes(name)) {
      problems.push(
        name === 'PORT'
          ? 'La variable PORT la define Kubero a partir del puerto del contenedor: quítala y configura ese puerto en su lugar'
          : `La variable ${name} la define Kubero: quítala`,
      );
    } else if (seen.has(name)) {
      problems.push(`La variable ${name} está repetida`);
    }
    seen.add(name);
  }
  return problems;
}

// Nombre DNS-1123 (label): el operador lo usa tal cual como nombre de
// recursos de Kubernetes, que rechaza espacios, mayúsculas, etc.
const DNS_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export function addonProblems(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return ['addons debe ser una lista'];
  const problems: string[] = [];
  for (const addon of value) {
    const definitions = addon?.resourceDefinitions;
    if (!definitions || typeof definitions !== 'object') continue;
    for (const [kind, definition] of Object.entries<any>(definitions)) {
      const name = definition?.metadata?.name;
      if (
        typeof name !== 'string' ||
        name.length > 63 ||
        !DNS_LABEL.test(name)
      ) {
        problems.push(
          `El nombre del addon "${name}" no es válido: usa solo minúsculas, números y guiones, sin espacios (máx. 63 caracteres)`,
        );
      }
      // El chart de Postgres genera una contraseña aleatoria cuando falta,
      // reutilizando la existente con `lookup`. Como `lookup` no devuelve nada
      // en el dry-run con que el operador detecta cambios, cada reconciliación
      // ve una contraseña distinta y lo actualiza una y otra vez.
      if (kind === 'KuberoAddonPostgres') {
        const auth = definition?.spec?.postgres?.auth ?? {};
        if (auth.enablePostgresUser !== false && !auth.postgresPassword) {
          problems.push(
            `El addon "${name}" necesita la contraseña del usuario postgres`,
          );
        }
        if (auth.username && auth.database && !auth.password) {
          problems.push(
            `El addon "${name}" necesita una contraseña para el usuario ${auth.username}`,
          );
        }
      }
    }
  }
  return problems;
}

class IngressDto {
  @IsOptional()
  @ValidateBy({
    name: 'hasOnlySafeIngressAnnotationKeys',
    validator: {
      validate: (value) => hasOnlySafeIngressAnnotationKeys(value),
      defaultMessage: () =>
        'ingress.annotations contiene claves de snippet o con formato no válido',
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

  @IsOptional()
  @ValidateBy({
    name: 'envVarsWithoutConflicts',
    validator: {
      validate: (value) => envVarProblems(value).length === 0,
      defaultMessage: (args) => envVarProblems(args?.value).join('. '),
    },
  })
  envVars?: unknown[];

  @IsOptional()
  @ValidateBy({
    name: 'validAddons',
    validator: {
      validate: (value) => addonProblems(value).length === 0,
      defaultMessage: (args) => addonProblems(args?.value).join('. '),
    },
  })
  addons?: unknown[];
}
