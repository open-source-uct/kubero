import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import * as dotenv from "dotenv";
import { ExtractJwt, Strategy } from "passport-jwt";
import { IdentityService } from "../identity.service";
import { getJwtSecret } from "../jwt-secret";

dotenv.config();

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(private readonly identity: IdentityService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: getJwtSecret(),
		});
	}

	// Un JWT firmado no basta: la identidad (rol, permisos, equipos) se lee de la
	// base de datos en cada request. Ver IdentityService.
	async validate(payload: any) {
		return this.identity.resolve(payload);
	}
}
