import { IsEmail, IsOptional, IsString } from 'class-validator';

// Datos que cada usuario puede cambiar de sí mismo desde su perfil.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // obligatoria solo si cambia el correo (ver UsersService.updateMyProfile)
  @IsOptional()
  @IsString()
  currentPassword?: string;
}
