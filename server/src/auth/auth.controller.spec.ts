import { HttpException } from '@nestjs/common';
import { LoginThrottleService } from './login-throttle.service';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthController } from './auth.controller';
import { LoginDTO } from './auth.dto';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const req = { ip: '203.0.113.7' };
  let service: jest.Mocked<AuthService>;

  beforeEach(async () => {
    service = {
      login: jest.fn(),
      validateToken: jest.fn(),
      getSession: jest.fn(),
      getMethods: jest.fn(),
      loginOAuth2: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: service },
        LoginThrottleService,
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('LoginDTO should reject an empty username or password', async () => {
      const errors = await validate(
        plainToInstance(LoginDTO, { username: '', password: '' }),
      );
      expect(errors.map((e) => e.property).sort()).toEqual([
        'password',
        'username',
      ]);
    });

    it('should call authService.login with username and password', async () => {
      service.login.mockResolvedValueOnce({ access_token: 'token' });
      const result = await controller.login(
        { username: 'user', password: 'pw' },
        req,
      );
      expect(service.login).toHaveBeenCalledWith('user', 'pw');
      expect(result).toEqual({ access_token: 'token' });
    });

    it('should answer 429 after too many failed logins and stop calling the auth service', async () => {
      service.login.mockRejectedValue(new HttpException('Forbidden', 403));
      for (let i = 0; i < LoginThrottleService.MAX_PER_IP_AND_USER; i++) {
        await expect(
          controller.login({ username: 'ana', password: 'x' }, req),
        ).rejects.toMatchObject({ status: 403 });
      }
      service.login.mockClear();
      await expect(
        controller.login({ username: 'ana', password: 'x' }, req),
      ).rejects.toMatchObject({ status: 429 });
      expect(service.login).not.toHaveBeenCalled();
    });

    it('should not count a successful login as a failure and clear previous ones', async () => {
      service.login.mockRejectedValueOnce(new HttpException('Forbidden', 403));
      await expect(
        controller.login({ username: 'ana', password: 'bad' }, req),
      ).rejects.toBeDefined();
      service.login.mockResolvedValue({ access_token: 't' });
      await controller.login({ username: 'ana', password: 'ok' }, req);
      // tras el acierto el contador quedó en cero: caben otros intentos fallidos
      service.login.mockRejectedValue(new HttpException('Forbidden', 403));
      for (let i = 0; i < LoginThrottleService.MAX_PER_IP_AND_USER; i++) {
        await expect(
          controller.login({ username: 'ana', password: 'x' }, req),
        ).rejects.toMatchObject({ status: 403 });
      }
    });
  });

  describe('logout', () => {
    it('should clear cookie and send logout message', async () => {
      const mockRes = {
        clearCookie: jest.fn(),
        send: jest.fn(),
      };
      await controller.logout(mockRes as any);
      expect(mockRes.clearCookie).toHaveBeenCalledWith('kubero.JWT_TOKEN');
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Logged out',
        status: '200',
      });
    });
  });

  describe('session', () => {
    it('should call getSession with isAuthenticated', async () => {
      service.validateToken.mockResolvedValueOnce(true);
      service.getSession.mockResolvedValueOnce({
        message: { foo: 'bar' },
        status: 200,
      });
      const mockReq = { headers: { authorization: 'Bearer token' } };
      const mockRes = { send: jest.fn() };
      await controller.session(mockReq as any, mockRes as any);
      expect(service.validateToken).toHaveBeenCalledWith('token');
      expect(service.getSession).toHaveBeenCalledWith(true);
      expect(mockRes.send).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('should call getSession with false if no auth header', async () => {
      service.getSession.mockResolvedValueOnce({
        message: { foo: 'bar' },
        status: 200,
      });
      const mockReq = { headers: {} };
      const mockRes = { send: jest.fn() };
      await controller.session(mockReq as any, mockRes as any);
      expect(service.getSession).toHaveBeenCalledWith(false);
      expect(mockRes.send).toHaveBeenCalledWith({ foo: 'bar' });
    });
  });

  describe('getMethods', () => {
    it('should return methods from service', async () => {
      service.getMethods.mockReturnValue({
        local: true,
        github: false,
        oauth2: true,
      });
      const result = await controller.getMethods();
      expect(result).toEqual({ local: true, github: false, oauth2: true });
    });
  });

  describe('githubCallback', () => {
    it('should set cookie and redirect', async () => {
      service.loginOAuth2.mockResolvedValueOnce('token');
      const mockReq = { user: { username: 'user' } };
      const mockRes = { cookie: jest.fn(), redirect: jest.fn() };
      await controller.githubCallback(mockReq as any, mockRes as any);
      expect(service.loginOAuth2).toHaveBeenCalledWith({ username: 'user' });
      expect(mockRes.cookie).toHaveBeenCalledWith('kubero.JWT_TOKEN', 'token');
      expect(mockRes.redirect).toHaveBeenCalledWith('/');
    });
  });

  describe('oauth2Callback', () => {
    it('should set cookie and redirect', async () => {
      service.loginOAuth2.mockResolvedValueOnce('token');
      const mockReq = { user: { username: 'user' } };
      const mockRes = { cookie: jest.fn(), redirect: jest.fn() };
      await controller.oauth2Callback(mockReq as any, mockRes as any);
      expect(service.loginOAuth2).toHaveBeenCalledWith({ username: 'user' });
      expect(mockRes.cookie).toHaveBeenCalledWith('kubero.JWT_TOKEN', 'token');
      expect(mockRes.redirect).toHaveBeenCalledWith('/');
    });
  });
});
