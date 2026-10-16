import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

export class CreateUserDto {
	@IsString()
	@IsNotEmpty()
	username: string;

	@IsEmail()
	email: string;

	@IsString()
	@MinLength(8)
	password: string;

	@IsOptional()
	@IsString()
	firstName?: string;

	@IsOptional()
	@IsString()
	lastName?: string;
}
