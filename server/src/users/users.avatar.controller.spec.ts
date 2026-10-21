import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../auth/strategies/jwt.guard';
import { MailService } from '../mail/mail.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('Avatar upload response (HTTP)', () => {
  let app: INestApplication;
  let authenticatedUserId: string | undefined;
  let storedUser: Record<string, unknown>;
  const update = jest.fn();
  const originalReadonly = process.env.KUBERO_READONLY;
  const passwordHash = 'synthetic-password-hash-never-send';
  const twoFaSecret = 'synthetic-2fa-secret-never-send';
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9kAAAAASUVORK5CYII=',
    'base64',
  );

  beforeAll(async () => {
    const service = new UsersService({
      sendPasswordChangedEmail: jest.fn(),
    } as unknown as MailService);
    Object.defineProperty(service, 'prisma', { value: { user: { update } } });
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          if (!authenticatedUserId) throw new UnauthorizedException();
          context.switchToHttp().getRequest().user = {
            userId: authenticatedUserId,
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  beforeEach(() => {
    authenticatedUserId = 'avatar-owner';
    delete process.env.KUBERO_READONLY;
    storedUser = {
      id: 'avatar-owner',
      username: 'avatar-owner',
      email: 'avatar-owner@example.invalid',
      image: null,
      password: passwordHash,
      twoFaSecret,
    };
    update
      .mockReset()
      .mockImplementation(
        (args: {
          where: { id: string };
          data: { image: string };
          omit?: Record<string, boolean>;
          select?: Record<string, boolean>;
        }) => {
          if (args.where.id !== storedUser.id)
            throw new Error('User not found');
          Object.assign(storedUser, args.data);
          // Reproduce la proyección de Prisma: sin omit/select devuelve los secretos.
          return Object.fromEntries(
            Object.entries(storedUser).filter(([key]) =>
              args.select ? args.select[key] === true : !args.omit?.[key],
            ),
          );
        },
      );
  });

  afterEach(() => {
    if (originalReadonly === undefined) {
      delete process.env.KUBERO_READONLY;
    } else {
      process.env.KUBERO_READONLY = originalReadonly;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([twoFaSecret, null])(
    'serializes the updated profile without credentials (2FA secret: %s)',
    async (secret) => {
      storedUser.twoFaSecret = secret;

      const response = await request(app.getHttpServer())
        .post('/api/users/profile/avatar')
        .attach('avatar', image, {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(201);

      expect(response.body).toEqual({
        id: 'avatar-owner',
        username: 'avatar-owner',
        email: 'avatar-owner@example.invalid',
        image: `data:image/png;base64,${image.toString('base64')}`,
      });
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('twoFaSecret');
      expect(response.text).not.toContain(passwordHash);
      expect(response.text).not.toContain(twoFaSecret);
      expect(storedUser.image).toBe(response.body.image);
      expect(storedUser.password).toBe(passwordHash);
      expect(storedUser.twoFaSecret).toBe(secret);
    },
  );

  it('only updates the authenticated account despite multipart identity fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/users/profile/avatar')
      .field('userId', 'another-user')
      .field('id', 'another-user')
      .attach('avatar', image, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.body.id).toBe('avatar-owner');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'avatar-owner' } }),
    );
  });

  it('requires authentication before updating an avatar', async () => {
    authenticatedUserId = undefined;

    await request(app.getHttpServer())
      .post('/api/users/profile/avatar')
      .attach('avatar', image, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(401);

    expect(update).not.toHaveBeenCalled();
  });

  it('preserves the read-only protection', async () => {
    process.env.KUBERO_READONLY = 'true';

    const response = await request(app.getHttpServer())
      .post('/api/users/profile/avatar')
      .attach('avatar', image, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(202);

    expect(response.body.message).toBe('Kubero is in read-only mode');
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a missing avatar', async () => {
    await request(app.getHttpServer())
      .post('/api/users/profile/avatar')
      .expect(400);

    expect(update).not.toHaveBeenCalled();
  });

  it('preserves the 100 KiB upload limit', async () => {
    await request(app.getHttpServer())
      .post('/api/users/profile/avatar')
      .attach('avatar', Buffer.alloc(102401), {
        filename: 'oversized.png',
        contentType: 'image/png',
      })
      .expect(400);

    expect(update).not.toHaveBeenCalled();
  });
});
