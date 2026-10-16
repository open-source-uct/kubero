import { Module } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "../auth/auth.service";
import { RolesService } from "../roles/roles.service";
import { UsersService } from "../users/users.service";
import { TokenController } from "./token.controller";
import { TokenService } from "./token.service";

@Module({
	providers: [TokenService, AuthService, UsersService, JwtService, RolesService],
	controllers: [TokenController],
})
export class TokenModule {}
