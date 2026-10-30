import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { KubernetesService } from '../kubernetes/kubernetes.service';
import { ConfigService } from '../config/config.service';
import { AuditService } from '../audit/audit.service';
import { AuditEntry } from '../audit/audit.interface';
import { RolesService } from '../roles/roles.service';
import { getJwtSecret } from './jwt-secret';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private rolesService: RolesService,
    private kubectl: KubernetesService,
    private configService: ConfigService,
    private auditService: AuditService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneFull(username);

    if (user) {
      if (user.isActive === false) {
        this.logger.warn(`Login blocked: user ${username} is disabled`);
        return null;
      }

      if (process.env.KUBERO_SESSION_KEY === undefined) {
        this.logger.error('KUBERO_SESSION_KEY is not defined');
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      }

      // DEPRECATED in v3.0.0: sha256 is considered insecure hashing. Kept for backward compatibility
      const password = crypto
        .createHmac('sha256', process.env.KUBERO_SESSION_KEY)
        .update(pass)
        .digest('hex');

      if (user.password === undefined) {
        this.logger.warn(
          `User ${username} does not have a password set. Please set a password for the user.`,
        );
        return null;
      }

      const passwordMatch = await bcrypt.compare(pass, user.password);
      //if (passwordMatch) {
      if (user.password === password || passwordMatch) {
        if (user.password === password) {
          if (!user.id) return null;
          const migrated = await this.usersService.migrateLegacyPassword(
            user.id,
            user.password,
            pass,
          );
          if (!migrated) return null;
        }
        const { password: _password, ...result } = user;
        return result;
      }
    }
    return null;
  }

  // Registra en la auditoría un evento de autenticación. No pertenece a ningún
  // pipeline, así que solo lo ve el admin (la auditoría de los demás roles se
  // filtra por sus pipelines). Antes no quedaba registro de quién entraba o
  // intentaba entrar, ni de quién pedía restablecer una contraseña.
  auditAuthEvent(
    action: string,
    message: string,
    userId = '1',
    severity: AuditEntry['severity'] = 'normal',
  ): void {
    void this.auditService.log({
      user: userId,
      severity,
      action,
      resource: 'security',
      namespace: '',
      phase: '',
      app: '',
      pipeline: '',
      message,
    });
  }

  async login(username: string, password: string, ip = 'desconocida') {
    const user = await this.validateUser(username, password);
    if (!user) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    this.auditAuthEvent(
      'login',
      `Inicio de sesión de ${user.username} (IP ${ip})`,
      user.id,
    );

    const { permissions, scopeToOwnTeam, priority } =
      await this.rolesService.getPermissions(user.roleId);
    user.permissions = permissions.map((p) => `${p.resource}:${p.action}`);

    // Defines the user object to be signed in the JWT
    // Add more fields if needed
    const u = {
      userId: user.id,
      username: user.username,
      role: user.role ? user.role.name : 'none',
      userGroups: user.userGroups ? user.userGroups.map((g) => g.name) : [],
      permissions: user.permissions ? user.permissions : [],
      scopeToOwnTeam,
      priority,
      strategy: 'local',
      sessionVersion: user.sessionVersion,
    };

    return {
      access_token: this.jwtService.sign(u),
    };
  }

  async loginOAuth2(reqUser: any) {
    const username = reqUser.username || reqUser.email || reqUser.id;
    const email =
      reqUser.emails[0]?.value || reqUser.email || 'undefined@kubero.dev';
    const provider = reqUser.provider || 'oauth2';
    // id inmutable del perfil (ej. el id numérico de GitHub), a diferencia
    // del username, que se puede renombrar o reciclar.
    const providerId =
      reqUser.id !== undefined ? String(reqUser.id) : undefined;

    // extract image data from url
    const image = reqUser.photos ? reqUser.photos[0]?.value : null;

    if (!username) {
      throw new HttpException(
        'Username or email not found in OAuth2 user data',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = (await this.usersService.findOneOrCreate(
      username,
      email,
      provider,
      image,
      providerId,
    )) as any;
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    if (user.isActive === false) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    const { permissions, scopeToOwnTeam, priority } =
      await this.rolesService.getPermissions(user.roleId);
    user.permissions = permissions.map((p) => `${p.resource}:${p.action}`);

    const u = {
      userId: user.id,
      username: user.username,
      role: user.role ? user.role.name : 'none',
      userGroups: user.userGroups ? user.userGroups.map((g) => g.name) : [],
      permissions: user.permissions ? user.permissions : [],
      scopeToOwnTeam,
      priority,
      strategy: 'oauth2',
      sessionVersion: user.sessionVersion,
    };
    return this.jwtService.sign(u);
  }

  async generateToken(
    userId: string,
    username: string,
    role: string,
    userGroups: string[],
    permissions: string[] = [],
    expiresAt?: string,
    tokenId?: string,
    scopeToOwnTeam = false,
    priority = 0,
  ): Promise<string> {
    if (!userId || !username || !role) {
      this.logger.error('Invalid user data for token generation', {
        userId,
        username,
        role,
        userGroups,
      });
      throw new HttpException('Invalid user data', HttpStatus.BAD_REQUEST);
    }
    const u = {
      userId: userId,
      username: username,
      role: role,
      userGroups: userGroups,
      permissions: permissions,
      scopeToOwnTeam,
      priority,
      strategy: 'token',
    };

    // el JWT debe expirar cuando el usuario lo pidió (expiresAt), no según
    // el tiempo de sesión normal (JWT_EXPIRESIN), que es de horas
    let expiresInSeconds =
      Number(process.env.JWT_EXPIRESIN?.replace('s', '')) || 36000;
    if (expiresAt) {
      const seconds = Math.floor(
        (new Date(expiresAt).getTime() - Date.now()) / 1000,
      );
      if (seconds <= 0) {
        throw new HttpException(
          'expiresAt must be in the future',
          HttpStatus.BAD_REQUEST,
        );
      }
      expiresInSeconds = seconds;
    }

    const token = this.jwtService.sign(u, {
      secret: getJwtSecret(),
      expiresIn: expiresInSeconds,
      // id de la fila Token: permite revocar el token borrándolo
      ...(tokenId ? { jwtid: tokenId } : {}),
    });
    return token;
  }

  async getSession(isAuthenticated): Promise<{ message: any; status: number }> {
    const status = 200;

    const message = {
      isAuthenticated: isAuthenticated,
      version: this.configService.getKuberoUIVersion(),
      kubernetesVersion: this.kubectl.getKubernetesVersion(),
      operatorVersion: this.kubectl.getOperatorVersion(),
      buildPipeline: this.configService.getBuildpipelineEnabled(),
      templatesEnabled: this.configService.getTemplateEnabled(),
      auditEnabled: this.auditService.getAuditEnabled(),
      adminDisabled: this.configService.checkAdminDisabled(),
      consoleEnabled: this.configService.getConsoleEnabled(),
      metricsEnabled: this.configService.getMetricsEnabled(),
      sleepEnabled: this.configService.getSleepEnabled(),
    };

    return { message: message, status: status };
  }

  async logout(user: { userId: string; strategy?: string }) {
    if (user.strategy === 'token') {
      throw new HttpException(
        'Interactive session required',
        HttpStatus.FORBIDDEN,
      );
    }
    await this.usersService.revokeSessions(user.userId);
  }

  getMethods(): { local: boolean; github: boolean; oauth2: boolean } {
    const methods = {
      local: ConfigService.getLocalauthEnabled(),
      github: ConfigService.getGithubEnabled(),
      oauth2: ConfigService.getOauth2Enabled(),
    };
    return methods;
  }
}
