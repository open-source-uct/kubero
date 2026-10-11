import { AuditService } from './audit.service';
import { PrismaClient } from '@prisma/client';
import { AuditEntry } from './audit.interface';

jest.mock('@prisma/client');

describe('AuditService', () => {
  let service: AuditService;
  let mockPrisma: PrismaClient;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
    Object.defineProperty(mockPrisma, 'audit', {
      value: {},
      writable: true,
      configurable: true,
    });

    process.env.KUBERO_AUDIT = 'true';
    process.env.KUBERO_AUDIT_LIMIT = '10';
    AuditService.prototype.init = jest.fn();
    service = new AuditService();
    service['enabled'] = true;
    service['prisma'] = mockPrisma;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should not enable audit if KUBERO_AUDIT is explicitly false', () => {
    process.env.KUBERO_AUDIT = 'false';
    const s = new AuditService();
    expect(s.getAuditEnabled()).toBe(false);
  });

  it('enables audit by default unless explicitly disabled', () => {
    delete process.env.KUBERO_AUDIT;
    expect(new AuditService().getAuditEnabled()).toBe(true);
  });

  it('filters and counts the same authorized rows before pagination', async () => {
    mockPrisma.audit.findMany = jest.fn().mockResolvedValue([]);
    mockPrisma.audit.count = jest.fn().mockResolvedValue(42);
    const result = await service.get(20, ['allowed'], {
      page: 2,
      pipeline: 'other-team',
      action: 'delete',
      username: 'sion',
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-09T00:00:00Z',
    });
    const where = {
      AND: [{ pipeline: { in: ['allowed'] } }, { pipeline: 'other-team' }],
      action: 'delete',
      users: { username: { contains: 'sion' } },
      timestamp: {
        gte: new Date('2026-10-01T00:00:00Z'),
        lt: new Date('2026-10-09T00:00:00Z'),
      },
    };
    expect(mockPrisma.audit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        skip: 20,
        take: 20,
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(mockPrisma.audit.count).toHaveBeenCalledWith({ where });
    expect(result).toEqual({
      audit: [],
      count: 42,
      limit: 20,
      page: 2,
      enabled: true,
    });
  });

  it('suggests only distinct pipeline names from authorized entries, capped at 20', async () => {
    mockPrisma.audit.findMany = jest
      .fn()
      .mockResolvedValue([{ pipeline: 'allowed' }]);
    expect(
      await service.getSuggestions({ kind: 'pipeline', q: 'allow' }, [
        'allowed',
      ]),
    ).toEqual(['allowed']);
    expect(mockPrisma.audit.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { pipeline: { in: ['allowed'] } },
          { pipeline: { not: '', contains: 'allow' } },
        ],
      },
      select: { pipeline: true },
      distinct: ['pipeline'],
      orderBy: { pipeline: 'asc' },
      take: 20,
    });
  });

  it('does not expose account data or usernames outside the authorized pipeline scope', async () => {
    mockPrisma.audit.findMany = jest.fn().mockResolvedValue([]);
    expect(
      await service.getSuggestions(
        { kind: 'username', q: 'admin', pipeline: 'other-team' },
        ['allowed'],
      ),
    ).toEqual([]);
    expect(mockPrisma.audit.findMany).toHaveBeenCalledWith({
      where: {
        AND: [{ pipeline: { in: ['allowed'] } }, { pipeline: 'other-team' }],
        users: { username: { contains: 'admin' } },
      },
      select: { users: { select: { username: true } } },
      distinct: ['user'],
      orderBy: { users: { username: 'asc' } },
      take: 20,
    });
  });

  it('does not query suggestions when auditing is disabled', async () => {
    service['enabled'] = false;
    mockPrisma.audit.findMany = jest.fn();
    expect(await service.getSuggestions({ kind: 'username' })).toEqual([]);
    expect(mockPrisma.audit.findMany).not.toHaveBeenCalled();
  });

  it('returns an explicit disabled state without querying the database', async () => {
    service['enabled'] = false;
    mockPrisma.audit.findMany = jest.fn();
    expect(await service.get(20)).toEqual({
      audit: [],
      count: 0,
      limit: 20,
      page: 1,
      enabled: false,
    });
    expect(mockPrisma.audit.findMany).not.toHaveBeenCalled();
  });
  /*
  it('init should log audit entry if enabled', async () => {
    const logSpy = jest.spyOn(AuditService.prototype, 'log').mockResolvedValue(undefined);
    service = new AuditService();
    service['enabled'] = true;
    await service.init();
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
      user: 'kubero',
      severity: 'normal',
      action: 'start',
      namespace: '',
      phase: '',
      app: '',
      pipeline: '',
      resource: 'system',
      message: 'server started',
    }));
  });
*/

  it('init should do nothing if not enabled', () => {
    const logSpy = jest.spyOn(service, 'log');
    service['enabled'] = false;
    service.init();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('should log an entry', async () => {
    const entry: AuditEntry = {
      user: 'test',
      severity: 'normal',
      action: 'create',
      namespace: 'ns',
      phase: 'dev',
      app: 'app',
      pipeline: 'pipe',
      resource: 'system',
      message: 'msg',
    };
    Object.defineProperty(mockPrisma, 'audit', {
      value: {},
      writable: true,
    });
    // create a local spy and assign it to the mock to avoid referencing an unbound method
    const createSpy = jest.fn().mockResolvedValue({});
    mockPrisma.audit.create = createSpy;
    mockPrisma.audit.count = jest.fn().mockResolvedValue(0);
    mockPrisma.audit.findMany = jest.fn().mockResolvedValue([]);
    mockPrisma.audit.deleteMany = jest.fn().mockResolvedValue({});
    await service.log(entry);
    expect(createSpy).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user: 'test',
        severity: 'normal',
        action: 'create',
        namespace: 'ns',
        phase: 'dev',
        app: 'app',
        pipeline: 'pipe',
        resource: 'system',
        message: 'msg',
      }),
    });
  });

  it('should get audit entries', async () => {
    const audits = [
      {
        id: 1,
        timestamp: new Date(),
        user: 'test',
        severity: 'normal',
        action: 'create',
        namespace: 'ns',
        phase: 'dev',
        app: 'app',
        pipeline: 'pipe',
        resource: 'system',
        message: 'msg',
      },
    ];
    mockPrisma.audit.findMany = jest.fn().mockResolvedValue(audits);
    mockPrisma.audit.count = jest.fn().mockResolvedValue(1);

    const result = await service.get(10);
    expect(result.audit).toEqual(audits);
    expect(result.count).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('should reset audit log', async () => {
    // ensure audit object exists and assign a local spy to avoid referencing an unbound method
    Object.defineProperty(mockPrisma, 'audit', {
      value: {},
      writable: true,
    });
    const deleteSpy = jest.fn().mockResolvedValue({});
    mockPrisma.audit.deleteMany = deleteSpy;
    const logSpy = jest.spyOn(service['logger'], 'log');
    await service.reset();
    expect(deleteSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('Audit log reset.');
  });

  it('should return 0 for count if not enabled', async () => {
    service['enabled'] = false;
    mockPrisma.audit.count = jest.fn().mockResolvedValue(0);

    const count = await service.count();
    expect(count).toBe(0);
  });

  it('should call flush in reset', async () => {
    const flushSpy = jest
      .spyOn(service as any, 'flush')
      .mockResolvedValue(undefined);
    await service.reset();
    expect(flushSpy).toHaveBeenCalled();
  });

  it('should not log if not enabled', async () => {
    service['enabled'] = false;

    const createSpy = jest.fn().mockResolvedValue({});
    mockPrisma.audit.create = createSpy;

    await service.log({
      user: 'test',
      severity: 'normal',
      action: 'create',
      namespace: 'ns',
      phase: 'dev',
      app: 'app',
      pipeline: 'pipe',
      resource: 'system',
      message: 'msg',
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('getFiltered returns filtered entries', async () => {
    const rows: AuditEntry[] = [
      {
        user: 'test',
        severity: 'normal',
        action: 'create',
        namespace: 'ns',
        phase: 'dev',
        app: 'app',
        pipeline: 'pipe',
        resource: 'system',
        message: 'foo',
      },
    ];
    // create local spy and assign to mock to avoid referencing an unbound method
    const findManySpy = jest.fn().mockResolvedValue(rows);
    mockPrisma.audit.findMany = findManySpy;

    const result = await service.getFiltered(10, 'foo');
    expect(findManySpy).toHaveBeenCalledWith({
      where: { message: { contains: 'foo' } },
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: {
        users: {
          select: { username: true },
        },
      },
    });
    expect(result).toEqual(rows);
  });

  it('getFiltered returns [] if disabled', async () => {
    service['enabled'] = false;
    const result = await service.getFiltered(10, 'foo');
    expect(result).toEqual([]);
  });

  it('getAppEntries returns app entries', async () => {
    const rows: AuditEntry[] = [
      {
        user: 'test',
        severity: 'normal',
        action: 'create',
        namespace: 'ns',
        phase: 'dev',
        app: 'app',
        pipeline: 'pipe',
        resource: 'system',
        message: 'foo',
      },
    ];
    // create local spy and assign to mock to avoid referencing an unbound method
    const findManySpy2 = jest.fn().mockResolvedValue(rows);

    mockPrisma.audit.findMany = findManySpy2;
    mockPrisma.audit.count = jest.fn().mockResolvedValue(rows.length);

    const result = await service.getAppEntries('pipe', 'dev', 'app', 5);
    expect(findManySpy2).toHaveBeenCalledWith({
      where: { pipeline: 'pipe', phase: 'dev', app: 'app' },
      orderBy: { timestamp: 'desc' },
      take: 5,
      include: {
        users: {
          select: { username: true },
        },
      },
    });
    expect(result).toEqual({ audit: rows, count: 1, limit: 5 });
  });

  it('getAppEntries returns [] if disabled', async () => {
    service['enabled'] = false;
    const result = await service.getAppEntries('pipe', 'dev', 'app', 5);
    expect(result).toEqual({ audit: [], count: 0, limit: 5 });
  });
});
