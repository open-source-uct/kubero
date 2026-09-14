import { IsString, IsNotEmpty } from 'class-validator';

export class ExecConsoleDto {
  @IsString()
  @IsNotEmpty()
  podName: string;

  @IsString()
  @IsNotEmpty()
  containerName: string;

  @IsString()
  @IsNotEmpty()
  command: string;
}
