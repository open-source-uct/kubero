import {
  Controller,
  Request,
  UseGuards,
  Post,
  Get,
  Response,
  Body,
  //HttpCode,
  //HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginThrottleService } from './login-throttle.service';
import { PasswordResetService } from './password-reset.service';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {
  GetMethodsDTO,
  LoginOKResponseDTO,
  LoginDTO,
  GetSessionDTO,
  ForgotPasswordDTO,
  ResetPasswordDTO,
} from './auth.dto';
import { OKDTO } from '../common/dto/ok.dto';
import { JwtAuthGuard } from './strategies/jwt.guard';
import { AuthGuard } from '@nestjs/passport';
import { SESSION_COOKIE, sessionCookieOptions } from './session-cookie';

@Controller({ path: 'api/auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginThrottle: LoginThrottleService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('login')
  @ApiOperation({
    summary: 'Login with username and password',
    description: 'Returns the login JWT token',
  })
  @ApiOkResponse({
    description: 'A List of Authentication Methods',
    type: LoginOKResponseDTO,
    isArray: false,
  })
  async login(
    @Body() auth: LoginDTO,
    @Request() req: any,
    @Response({ passthrough: true }) res: any,
  ) {
    const ip: string = req?.ip ?? 'unknown';
    // 429 si ya hubo demasiados intentos fallidos con este usuario
    this.loginThrottle.assertAllowed(ip, auth.username);
    try {
      const result = await this.authService.login(auth.username, auth.password);
      res.cookie(
        SESSION_COOKIE,
        result.access_token,
        sessionCookieOptions(req),
      );
      res.setHeader('Cache-Control', 'no-store');
      this.loginThrottle.reset(ip, auth.username);
      return result;
    } catch (error) {
      this.loginThrottle.recordFailure(ip, auth.username);
      throw error;
    }
  }

  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request a password reset link',
    description:
      'Siempre responde OK, exista o no el correo, para no revelar qué cuentas existen.',
  })
  @ApiOkResponse({ type: OKDTO, isArray: false })
  async forgotPassword(
    @Body() dto: ForgotPasswordDTO,
    @Request() req: any,
  ): Promise<OKDTO> {
    const ip: string = req?.ip ?? 'unknown';
    await this.passwordResetService.requestReset(dto.email, ip);
    return {
      message:
        'Si el correo existe, te llegará un enlace para restablecer tu contraseña.',
      status: '200',
    } as OKDTO;
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset the password using a token from the forgot-password email',
  })
  @ApiOkResponse({ type: OKDTO, isArray: false })
  async resetPassword(
    @Body() dto: ResetPasswordDTO,
    @Request() req: any,
  ): Promise<OKDTO> {
    const ip: string = req?.ip ?? 'unknown';
    await this.passwordResetService.resetPassword(
      dto.token,
      dto.newPassword,
      ip,
    );
    return { message: 'Contraseña actualizada', status: '200' } as OKDTO;
  }

  @Get('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Logout the current session',
    description:
      'Revokes all interactive sessions for the current user (Bearer only on GET)',
  })
  @ApiOkResponse({
    description: 'Logout OK',
    type: OKDTO,
    isArray: false,
  })
  async logout(@Response() res: any, @Request() req: any): Promise<void> {
    await this.authService.logout(req.user);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(req));
    res.send({ message: 'Logged out', status: '200' } as OKDTO);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logoutPost(@Response() res: any, @Request() req: any): Promise<void> {
    return this.logout(res, req);
  }

  @Get('session')
  @ApiOperation({
    summary: 'Get the current session',
    description: 'Returns the current session information',
  })
  @ApiOkResponse({
    description: 'Session Information',
    type: GetSessionDTO,
    isArray: false,
  })
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearerAuth')
  async session(@Request() req, @Response() res) {
    // status siempre es 200 (ver getSession), no hace falta aplicarlo
    const { message } = await this.authService.getSession(true);
    res.setHeader('Cache-Control', 'no-store');
    res.send({ ...message, user: req.user });
  }

  @Get('methods')
  @ApiOperation({
    summary: 'Get the available authentication methods',
    description: 'Returns a list of available authentication methods',
  })
  @ApiOkResponse({
    description: 'A List of Authentication Methods',
    type: GetMethodsDTO,
    isArray: false,
  })
  async getMethods(): Promise<GetMethodsDTO> {
    return this.authService.getMethods();
  }

  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiBearerAuth('OAuth2')
  async github() {
    return 'auth';
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiBearerAuth('OAuth2')
  async githubCallback(@Request() req: any, @Response() res: any) {
    //console.log(req.user); // debug github user data
    const token = await this.authService.loginOAuth2(req.user);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req));
    res.setHeader('Cache-Control', 'no-store');
    res.redirect('/');
  }

  @Get('oauth2')
  @UseGuards(AuthGuard('oauth2'))
  @ApiBearerAuth('OAuth2')
  async oauth2() {
    return 'auth';
  }

  @Get('oauth2/callback')
  @UseGuards(AuthGuard('oauth2'))
  @ApiBearerAuth('OAuth2')
  async oauth2Callback(@Request() req: any, @Response() res: any) {
    //console.log(req.user);
    const token = await this.authService.loginOAuth2(req.user);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req));
    res.setHeader('Cache-Control', 'no-store');
    res.redirect('/');
  }
}
