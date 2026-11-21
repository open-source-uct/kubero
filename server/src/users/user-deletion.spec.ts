import { mkdtemp, readFile, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { UsersService } from './users.service';

jest.mock('dotenv', () => ({ config: jest.fn() }));

// Borrado de usuarios con tokens y auditoría sobre un SQLite desechable: se
// aplica el esquema anterior, se reproduce el error, se aplica la migración y
// se comprueba que conserva los datos y permite el borrado.
describe('user deletion with tokens and audit (isolated SQLite)', () => {
  const MIGRATION = '20261121042100_audit_token_on_user_delete';
  let directory: string;
  let prisma: PrismaClient;
  let users: UsersService;

  const applyMigration = async (name: string) => {
    const sql = await readFile(
      join(__dirname, '../../prisma/migrations', name, 'migration.sql'),
      'utf8',
    );
    for (const statement of sql.split(';').filter((s) => s.trim())) {
      await prisma.$executeRawUnsafe(statement);
    }
  };

  const createUser = (id: string) =>
    prisma.user.create({
      data: {
        id,
        username: id,
        email: `${id}@example.test`,
        password: 'x',
      },
    });

  const createToken = (id: string, userId: string) =>
    prisma.token.create({
      data: {
        id,
        userId,
        expiresAt: new Date(Date.now() + 3600_000),
        role: 'member',
        groups: '[]',
      },
    });

  const createAudit = (user: string) =>
    prisma.audit.create({
      data: {
        user,
        action: 'create',
        namespace: 'demo',
        phase: 'production',
        app: 'web',
        pipeline: 'demo',
        message: 'created app',
      },
    });

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'kubero-user-deletion-'));
    // una sola conexión: los PRAGMA de las migraciones valen por conexión
    prisma = new PrismaClient({
      datasourceUrl: `file:${join(directory, 'test.sqlite').replace(/\\/g, '/')}?connection_limit=1`,
    });
    const migrations = join(__dirname, '../../prisma/migrations');
    const previous = (await readdir(migrations))
      .filter((n) => /^\d/.test(n) && n < MIGRATION)
      .sort();
    for (const name of previous) {
      await applyMigration(name);
    }
    users = new UsersService({ sendPasswordChangedEmail: jest.fn() } as any);
    Object.defineProperty(users, 'prisma', { value: prisma });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
  });

  it('before the migration, reports the blocked deletion instead of hiding it', async () => {
    await createUser('student');
    await createUser('other');
    await createToken('t-student', 'student');
    await createToken('t-other', 'other');
    await createAudit('student');
    await createAudit('student');
    await createAudit('other');

    await expect(users.delete('student')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(
      await prisma.user.findUnique({ where: { id: 'student' } }),
    ).not.toBeNull();
  });

  it('the migration keeps every token and audit record', async () => {
    await applyMigration(MIGRATION);

    expect(await prisma.token.count()).toBe(2);
    expect(await prisma.audit.count()).toBe(3);
    expect(await prisma.audit.count({ where: { user: 'student' } })).toBe(2);
  });

  it('deletes the user with its tokens and keeps its audit records without author', async () => {
    await expect(users.delete('student')).resolves.toBeUndefined();

    expect(
      await prisma.user.findUnique({ where: { id: 'student' } }),
    ).toBeNull();
    expect(await prisma.token.findMany({ select: { id: true } })).toEqual([
      { id: 't-other' },
    ]);
    expect(await prisma.audit.count()).toBe(3);
    expect(await prisma.audit.count({ where: { user: null } })).toBe(2);
    expect(await prisma.audit.count({ where: { user: 'other' } })).toBe(1);
  });

  it('reports a user that does not exist as not found', async () => {
    await expect(users.delete('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
