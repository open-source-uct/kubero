import { IsString, IsNotEmpty } from 'class-validator';

export class ValidateKubeconfigDto {
  @IsString()
  @IsNotEmpty()
  kubeconfig: string;

  @IsString()
  @IsNotEmpty()
  context: string;
}
