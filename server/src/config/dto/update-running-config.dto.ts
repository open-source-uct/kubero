import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateRunningConfigDto {
  @IsString()
  @IsNotEmpty()
  KUBECONFIG_BASE64: string;

  @IsString()
  @IsNotEmpty()
  KUBERO_CONTEXT: string;

  @IsString()
  @IsNotEmpty()
  KUBERO_NAMESPACE: string;

  @IsString()
  @IsNotEmpty()
  KUBERO_SESSION_KEY: string;

  @IsString()
  @IsNotEmpty()
  KUBERO_WEBHOOK_SECRET: string;
}
