import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { Permissions, PermissionsAll } from './permissions.decorator';

class Dummy {
  @Permissions('app:read', 'app:write')
  any() {}

  @PermissionsAll('app:write', 'console:ok')
  all() {}

  @Permissions('app:write')
  @PermissionsAll('console:ok')
  both() {}

  open() {}
}

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  const ctx = (handler: () => void, user: any): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => Dummy,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as any;

  const proto = Dummy.prototype;

  it('lets everyone through a handler without permissions', () => {
    expect(guard.canActivate(ctx(proto.open, undefined))).toBe(true);
  });

  it('requires a user with permissions', () => {
    expect(() => guard.canActivate(ctx(proto.any, undefined))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(ctx(proto.any, {}))).toThrow(
      ForbiddenException,
    );
  });

  describe('@Permissions (any of)', () => {
    it('accepts a user with one of them', () => {
      expect(
        guard.canActivate(ctx(proto.any, { permissions: ['app:read'] })),
      ).toBe(true);
    });

    it('rejects a user with none', () => {
      expect(() =>
        guard.canActivate(ctx(proto.any, { permissions: ['pipeline:read'] })),
      ).toThrow(ForbiddenException);
    });
  });

  describe('@PermissionsAll (all of)', () => {
    it('accepts a user with all of them', () => {
      expect(
        guard.canActivate(
          ctx(proto.all, { permissions: ['app:write', 'console:ok'] }),
        ),
      ).toBe(true);
    });

    it('rejects a user missing one (app:write without console:ok)', () => {
      expect(() =>
        guard.canActivate(ctx(proto.all, { permissions: ['app:write'] })),
      ).toThrow(ForbiddenException);
      expect(() =>
        guard.canActivate(ctx(proto.all, { permissions: ['console:ok'] })),
      ).toThrow(ForbiddenException);
    });
  });

  it('applies any-of and all-of together when both are set', () => {
    expect(
      guard.canActivate(
        ctx(proto.both, { permissions: ['app:write', 'console:ok'] }),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(ctx(proto.both, { permissions: ['app:write'] })),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(ctx(proto.both, { permissions: ['console:ok'] })),
    ).toThrow(ForbiddenException);
  });
});
