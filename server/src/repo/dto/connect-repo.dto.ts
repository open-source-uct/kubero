import { IsString, IsNotEmpty } from 'class-validator';

export class ConnectRepoDto {
  @IsString()
  @IsNotEmpty()
  gitrepo: string;
}
