import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator';
import { AuthenticatedUser } from './identity.service';

export class GetMethodsDTO {
  @ApiProperty({ default: false })
  local: boolean;

  @ApiProperty({ default: false })
  github: boolean;

  @ApiProperty({ default: false })
  oauth2: boolean;
}

export class LoginOKResponseDTO {
  @ApiProperty()
  access_token: string;
}

export class LoginDTO {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ForgotPasswordDTO {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDTO {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class GetSessionDTO {
  @ApiProperty({
    description:
      'Current identity and effective permissions, without credentials',
    type: Object,
  })
  user: AuthenticatedUser;
  @ApiProperty()
  isAuthenticated: boolean;
  @ApiProperty()
  version: string;
  @ApiProperty()
  kubernetesVersion: string;
  @ApiProperty()
  operatorVersion: string;
  @ApiProperty()
  buildPipeline: boolean;
  @ApiProperty()
  templatesEnabled: boolean;
  @ApiProperty()
  auditEnabled: boolean;
  @ApiProperty()
  adminDisabled: boolean;
  @ApiProperty()
  consoleEnabled: boolean;
  @ApiProperty()
  metricsEnabled: boolean;
  @ApiProperty()
  sleepEnabled: boolean;
}
