import { mkdtemp, readFile, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { createHmac } from 'crypto';
import { UsersService } from '../users/users.service';
import { TokenService } from '../token/token.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IdentityService } from './identity.service';
import { LoginThrottleService } from './login-throttle.service';
import { PasswordResetService } from './password-reset.service';
import { JwtStrategy } from './strategies/jwt.strategy';

jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('./jwt-secret', () => ({
  getJwtSecret: () => 'issue-203-test-secret',
}));

// Real SQLite, bcrypt, JWT and Passport, all confined to a disposable database.
describe('session lifecycle (isolated SQLite and HTTP)', () => {
  let app: INestApplication;
  let directory: string;
  let prisma: PrismaClient;
  let users: UsersService;
  let auth: AuthService;
  let identity: IdentityService;
  let tokens: TokenService;
  const jwt = new JwtService({
    secret: 'issue-203-test-secret',
    signOptions: { expiresIn: '1h' },
  });
  const previousKey = process.env.KUBERO_SESSION_KEY;

  beforeAll(async () => {
    process.env.KUBERO_SESSION_KEY = 'issue-203-test-key';
    directory = await mkdtemp(join(tmpdir(), 'kubero-session-203-'));
    prisma = new PrismaClient({
      datasourceUrl: `file:${join(directory, 'test.sqlite').replace(/\\/g, '/')}`,
    });
    const migrations = join(__dirname, '../../prisma/migrations');
    for (const name of (await readdir(migrations))
      .filter((n) => /^\d/.test(n))
      .sort()) {
      const sql = await readFile(
        join(migrations, name, 'migration.sql'),
        'utf8',
      );
      for (const statement of sql.split(';').filter((s) => s.trim())) {
        await prisma.$executeRawUnsafe(statement);
      }
    }
    const roles: any = {
      getPermissions: async (roleId: string) => ({
        permissions:
          roleId === 'r2'
            ? [
                { resource: 'token', action: 'ok' },
                { resource: 'app', action: 'write' },
              ]
            : [{ resource: 'token', action: 'ok' }],
        scopeToOwnTeam: roleId !== 'r2',
        priority: roleId === 'r2' ? 50 : 10,
      }),
    };
    users = new UsersService({ sendPasswordChangedEmail: jest.fn() } as any);
    Object.defineProperty(users, 'prisma', { value: prisma });
    auth = new AuthService(users, roles, {} as any, {} as any, {} as any, jwt);
    identity = new IdentityService(users, roles);
    tokens = new TokenService(auth, users, roles);
    Object.defineProperty(tokens, 'prisma', { value: prisma });
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: IdentityService, useValue: identity },
        JwtStrategy,
        LoginThrottleService,
        {
          provide: PasswordResetService,
          useValue: { requestReset: jest.fn(), resetPassword: jest.fn() },
        },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    await prisma.role.create({ data: { id: 'r1', name: 'member' } });
    await prisma.role.create({ data: { id: 'r2', name: 'webmaster' } });
  }, 30000);

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    if (directory) await rm(directory, { recursive: true, force: true });
    if (previousKey === undefined) delete process.env.KUBERO_SESSION_KEY;
    else process.env.KUBERO_SESSION_KEY = previousKey;
  });

  beforeEach(async () => {
    await prisma.token.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({
      data: {
        id: 'u1',
        username: 'ana',
        email: 'ana@example.test',
        password: await bcrypt.hash('initial-test-password', 10),
        roleId: 'r1',
      },
    });
  });

  async function login() {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'ana', password: 'initial-test-password' })
      .expect(201);
    return {
      token: res.body.access_token,
      cookie: res.headers['set-cookie'][0].split(';')[0],
      res,
    };
  }

  it('issues an HttpOnly SameSite cookie and supports cookie or Bearer HTTP authentication', async () => {
    const sessionInfo = { message: { isAuthenticated: true }, status: 200 };
    jest.spyOn(auth, 'getSession').mockResolvedValueOnce(sessionInfo);
    const { token, cookie, res } = await login();
    expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(res.headers['set-cookie'][0]).toContain('SameSite=Lax');
    expect(res.headers['cache-control']).toBe('no-store');
    const session = await request(app.getHttpServer())
      .get('/api/auth/session')
      .set('Cookie', cookie)
      .expect(200);
    expect(session.body.user).toMatchObject({
      userId: 'u1',
      permissions: ['token:ok'],
    });
    expect(JSON.stringify(session.body)).not.toContain(token);
    jest.spyOn(auth, 'getSession').mockResolvedValueOnce(sessionInfo);
    await request(app.getHttpServer())
      .get('/api/auth/session')
      .auth(token, { type: 'bearer' })
      .expect(200);
  });

  it('revokes all issued session JWTs at logout and clears the cookie', async () => {
    const first = await login();
    const second = await login();
    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Host', 'kubero.test')
      .set('Origin', 'http://kubero.test')
      .set('Cookie', first.cookie)
      .expect(201);
    expect(res.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
    for (const token of [first.token, second.token]) {
      await request(app.getHttpServer())
        .get('/api/auth/session')
        .auth(token, { type: 'bearer' })
        .expect(401);
    }
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: 'u1' } }))
        .sessionVersion,
    ).toBe(1);
    const fresh = await login();
    await expect(
      identity.resolve(jwt.verify(fresh.token)),
    ).resolves.toMatchObject({ userId: 'u1' });
  });

  it('rejects pre-migration sessions and mismatched session versions', async () => {
    for (const sessionVersion of [undefined, 1]) {
      const token = jwt.sign({
        userId: 'u1',
        strategy: 'local',
        sessionVersion,
      });
      await request(app.getHttpServer())
        .get('/api/auth/session')
        .auth(token, { type: 'bearer' })
        .expect(401);
    }
  });

  it('rejects cross-origin cookie mutations and cookie GET logout without revoking the session', async () => {
    const { cookie } = await login();
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set('Origin', 'https://attacker.test')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/logout')
      .set('Cookie', cookie)
      .expect(401);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: 'u1' } }))
        .sessionVersion,
    ).toBe(0);
  });

  it.each(['own', 'admin'])(
    'revokes sessions and personal tokens on %s password change',
    async (mode) => {
      const { token } = await login();
      const caller = await identity.resolve(jwt.verify(token));
      const personal = await tokens.create(
        'test',
        new Date(Date.now() + 60000).toISOString(),
        'u1',
        caller,
      );
      if (mode === 'own')
        await users.updateMyPassword(
          'u1',
          'initial-test-password',
          'new-test-password',
        );
      else await users.updatePassword('u1', 'new-test-password');
      await expect(identity.resolve(jwt.verify(token))).rejects.toThrow();
      await expect(
        identity.resolve(jwt.verify(personal.token)),
      ).rejects.toThrow();
      await expect(
        auth.login('ana', 'initial-test-password'),
      ).rejects.toThrow();
      const fresh = await auth.login('ana', 'new-test-password');
      await expect(
        identity.resolve(jwt.verify(fresh.access_token)),
      ).resolves.toMatchObject({ userId: 'u1' });
    },
  );

  it('prevents a personal token from minting another token after a promotion', async () => {
    const { token } = await login();
    const caller = await identity.resolve(jwt.verify(token));
    const personal = await tokens.create(
      'test',
      new Date(Date.now() + 60000).toISOString(),
      'u1',
      caller,
    );
    await prisma.user.update({ where: { id: 'u1' }, data: { roleId: 'r2' } });
    const delegated = await identity.resolve(jwt.verify(personal.token));
    expect(delegated.permissions).not.toContain('app:write');
    expect(delegated).toMatchObject({ scopeToOwnTeam: true, priority: 10 });
    await expect(
      tokens.create(
        'child',
        new Date(Date.now() + 60000).toISOString(),
        'u1',
        delegated,
      ),
    ).rejects.toThrow('Interactive session required');
    expect(await prisma.token.count()).toBe(1);
  });

  it('migrates a verified legacy hash to bcrypt without resetting the session version', async () => {
    const legacy = createHmac('sha256', 'issue-203-test-key')
      .update('legacy-test-password')
      .digest('hex');
    await prisma.user.update({
      where: { id: 'u1' },
      data: { password: legacy },
    });
    await expect(auth.login('ana', 'wrong-password')).rejects.toThrow();
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: 'u1' } })).password,
    ).toBe(legacy);
    const result = await auth.login('ana', 'legacy-test-password');
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: 'u1' } });
    expect(bcrypt.getRounds(stored.password)).toBe(10);
    expect(await bcrypt.compare('legacy-test-password', stored.password)).toBe(
      true,
    );
    expect(stored.sessionVersion).toBe(0);
    await expect(
      identity.resolve(jwt.verify(result.access_token)),
    ).resolves.toMatchObject({ userId: 'u1' });
    // A login reading an older hash cannot overwrite a concurrent reset.
    expect(
      await users.migrateLegacyPassword('u1', legacy, 'legacy-test-password'),
    ).toBe(false);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: 'u1' } })).password,
    ).toBe(stored.password);
  });
});
