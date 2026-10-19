import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsArray,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Sin validación de tipo a propósito: si no se cambia el rol, el formulario
  // reenvía el objeto { id, name } que cargó, y UsersService.update solo
  // aplica el cambio cuando llega un id (string).
  @IsOptional()
  role?: unknown;

  // ids de los equipos, u objetos { id, name } si no se tocaron
  @IsOptional()
  @IsArray()
  userGroups?: unknown[];
}
