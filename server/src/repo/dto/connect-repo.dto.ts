import { IsNotEmpty, IsString } from "class-validator";

export class ConnectRepoDto {
	@IsString()
	@IsNotEmpty()
	gitrepo: string;
}
