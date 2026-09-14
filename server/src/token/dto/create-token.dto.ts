import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateTokenDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDateString()
  expiresAt: string;
}
