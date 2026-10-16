import { IsDateString, IsNotEmpty, IsString } from "class-validator";

export class CreateTokenDto {
	@IsString()
	@IsNotEmpty()
	name: string;

	@IsDateString()
	expiresAt: string;
}
