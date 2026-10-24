import { BadRequestException, HttpException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PasswordResetService } from './password-reset.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { PasswordResetThrottleService } from './password-reset-throttle.service';

function hash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let prismaMock: {
    user: { findUnique: jest.Mock };
    passwordResetToken: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let mailMock: jest.Mocked<Pick<MailService, 'sendPasswordResetEmail'>>;
  let usersMock: jest.Mocked<Pick<UsersService, 'updatePassword'>>;
  let throttleMock: jest.Mocked<PasswordResetThrottleService>;
  const previousUrl = process.env.KUBERO_URL;

  beforeEach(() => {
    process.env.KUBERO_URL = 'https://kubero.example.com';

    prismaMock = {
      user: { findUnique: jest.fn() },
      passwordResetToken: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    mailMock = { sendPasswordResetEmail: jest.fn() } as any;
    usersMock = { updatePassword: jest.fn() } as any;
    throttleMock = {
      assertAllowed: jest.fn(),
      record: jest.fn(),
    } as any;

    service = new PasswordResetService(
      mailMock as unknown as MailService,
      usersMock as unknown as UsersService,
      throttleMock,
    );
    // @ts-expect-error prisma es privado; se reemplaza por un mock
    service['prisma'] = prismaMock;
  });

  afterAll(() => {
    if (previousUrl === undefined) delete process.env.KUBERO_URL;
    else process.env.KUBERO_URL = previousUrl;
  });

  describe('requestReset', () => {
    it('propagates the 429 of the throttle without llegar a la base de datos', async () => {
      throttleMock.assertAllowed.mockImplementation(() => {
        throw new HttpException('Too many requests', 429);
      });
      await expect(
        service.requestReset('ana@example.com', '1.1.1.1'),
      ).rejects.toThrow(HttpException);
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('no manda nada si KUBERO_URL no está configurado', async () => {
      delete process.env.KUBERO_URL;
      await service.requestReset('ana@example.com', '1.1.1.1');
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
      expect(mailMock.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('no revela que el correo no existe (no manda nada, pero no lanza error)', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.requestReset('fantasma@example.com', '1.1.1.1'),
      ).resolves.toBeUndefined();
      expect(mailMock.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('no manda nada para una cuenta inactiva', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 'ana@example.com',
        isActive: false,
        provider: 'local',
      });
      await service.requestReset('ana@example.com', '1.1.1.1');
      expect(mailMock.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('no manda nada para una cuenta de GitHub/OAuth2 (no tiene contraseña real)', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 'ana@example.com',
        isActive: true,
        provider: 'github',
      });
      await service.requestReset('ana@example.com', '1.1.1.1');
      expect(mailMock.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('crea un token nuevo, invalida los anteriores y manda el correo', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 'ana@example.com',
        firstName: 'Ana',
        lastName: 'Lopez',
        username: 'ana',
        isActive: true,
        provider: 'local',
      });

      await service.requestReset('ana@example.com', '1.1.1.1');

      expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', usedAt: null },
      });
      expect(prismaMock.passwordResetToken.create).toHaveBeenCalledTimes(1);
      const createArgs = prismaMock.passwordResetToken.create.mock.calls[0][0];
      expect(createArgs.data.userId).toBe('u1');
      expect(createArgs.data.tokenHash).toHaveLength(64); // sha256 en hex
      expect(createArgs.data.expiresAt).toBeInstanceOf(Date);

      expect(mailMock.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      const [to, displayName, resetUrl] =
        mailMock.sendPasswordResetEmail.mock.calls[0];
      expect(to).toBe('ana@example.com');
      expect(displayName).toBe('Ana Lopez');
      expect(resetUrl).toMatch(
        /^https:\/\/kubero\.example\.com\/reset-password\?token=[0-9a-f]{64}$/,
      );
    });
  });

  describe('resetPassword', () => {
    it('rechaza un token que no existe', async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.resetPassword('no-existe', 'nuevaPassword123', '1.1.1.1'),
      ).rejects.toThrow(BadRequestException);
      expect(usersMock.updatePassword).not.toHaveBeenCalled();
    });

    it('rechaza un token ya usado', async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValueOnce({
        id: 't1',
        userId: 'u1',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
      await expect(
        service.resetPassword('token-usado', 'nuevaPassword123', '1.1.1.1'),
      ).rejects.toThrow(BadRequestException);
      expect(usersMock.updatePassword).not.toHaveBeenCalled();
    });

    it('rechaza un token vencido', async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValueOnce({
        id: 't1',
        userId: 'u1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.resetPassword('token-vencido', 'nuevaPassword123', '1.1.1.1'),
      ).rejects.toThrow(BadRequestException);
      expect(usersMock.updatePassword).not.toHaveBeenCalled();
    });

    it('con un token válido, marca el token usado y actualiza la contraseña', async () => {
      const rawToken = 'un-token-valido';
      prismaMock.passwordResetToken.findUnique.mockResolvedValueOnce({
        id: 't1',
        userId: 'u1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      usersMock.updatePassword.mockResolvedValueOnce({ id: 'u1' } as any);

      await service.resetPassword(rawToken, 'nuevaPassword123', '1.1.1.1');

      expect(prismaMock.passwordResetToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: hash(rawToken) },
      });
      expect(prismaMock.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { usedAt: expect.any(Date) },
      });
      expect(usersMock.updatePassword).toHaveBeenCalledWith(
        'u1',
        'nuevaPassword123',
      );
    });

    it('falla si no se pudo actualizar la contraseña del usuario', async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValueOnce({
        id: 't1',
        userId: 'u1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      usersMock.updatePassword.mockResolvedValueOnce(undefined);

      await expect(
        service.resetPassword('valido', 'nuevaPassword123', '1.1.1.1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
