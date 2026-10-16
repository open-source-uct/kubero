import { Module, Provider } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import * as dotenv from "dotenv";
import { AuditModule } from "../audit/audit.module";
import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";
import { KubernetesModule } from "../kubernetes/kubernetes.module";
import { RolesService } from "../roles/roles.service";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { IdentityService } from "./identity.service";
import { getJwtSecret } from "./jwt-secret";
import { LoginThrottleService } from "./login-throttle.service";
import { GithubStrategy } from "./strategies/github.strategy";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { Oauth2Strategy } from "./strategies/oauth2.strategy";

dotenv.config();

const providers: Provider[] = [
	AuthService,
	JwtStrategy,
	RolesService,
	IdentityService,
	LoginThrottleService,
];
if (ConfigService.getOauth2Enabled()) {
	providers.push(Oauth2Strategy);
}
if (ConfigService.getGithubEnabled()) {
	providers.push(GithubStrategy);
}

@Module({
	imports: [
		UsersModule,
		PassportModule,
		AuditModule,
		KubernetesModule,
		ConfigModule,
		JwtModule.register({
			secret: getJwtSecret(),
			signOptions: {
				expiresIn: process.env.JWT_EXPIRESIN || "36000s",
			},
		}),
	],
	providers: providers,
	controllers: [AuthController],
	exports: [AuthService, JwtModule, UsersModule, IdentityService],
})
export class AuthModule {}
