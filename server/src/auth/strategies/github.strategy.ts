import { Strategy, StrategyOptions, Profile } from 'passport-github2';
import { PassportStrategy } from '@nestjs/passport';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticateOptions } from 'passport';
import { ConfigService } from '../../config/config.service';
import { StatelessOauthStateStore } from '../oauth-state.store';
import { isGithubOrgMember } from '../github-org.util';
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CLIENT_CALLBACKURL,
      scope: ConfigService.getAuthenticationScope(
        process.env.GITHUB_CLIENT_SCOPE,
      ),
      userAgent: 'kubero/v3',
      // sin esto, passport-oauth2 no agrega ni valida el parámetro "state"
      // del flujo OAuth (login CSRF). Un store propio porque Kubero no usa
      // sesiones de servidor (el store por defecto necesita req.session).
      store: new StatelessOauthStateStore(),
    } as StrategyOptions);
  }
  async validate(accessToken: string, _refreshToken: string, profile: Profile) {
    const org = process.env.GITHUB_CLIENT_ORG;
    // GITHUB_CLIENT_ORG antes solo marcaba el login de GitHub como
    // "habilitado" en la configuración; nunca se comprobaba la membresía.
    if (org && !(await isGithubOrgMember(accessToken, org))) {
      throw new ForbiddenException(
        `GitHub user is not a member of the "${org}" organization`,
      );
    }
    return profile;
  }
  authenticate(req: Request, options?: AuthenticateOptions): void {
    //console.log('Github2Strategy.authenticate', req, options);
    //console.log('Github2Strategy.authenticate');
    super.authenticate(req, options);
  }
}
