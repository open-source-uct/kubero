import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_ALL_KEY, PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    /* Disabling for RBAC
    if (
      !process.env.KUBERO_USERS &&
      !process.env.GITHUB_CLIENT_SECRET &&
      !process.env.OAUTH2_CLIENT_SECRET
    ) {
      return true;
    }
    */

    const requiredAll = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_ALL_KEY,
      [context.getHandler(), context.getClass()],
    );

    const needsAny = !!requiredPermissions && requiredPermissions.length > 0;
    const needsAll = !!requiredAll && requiredAll.length > 0;
    if (!needsAny && !needsAll) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.permissions) {
      throw new ForbiddenException('No permissions found');
    }

    if (
      needsAny &&
      !requiredPermissions.some((perm) => user.permissions.includes(perm))
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
    if (
      needsAll &&
      !requiredAll.every((perm) => user.permissions.includes(perm))
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
