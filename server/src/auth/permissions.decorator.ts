import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const PERMISSIONS_ALL_KEY = 'permissions_all';

// El usuario necesita AL MENOS UNO de estos permisos.
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// El usuario necesita TODOS estos permisos (por ejemplo la consola exige
// app:write y además console:ok).
export const PermissionsAll = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_ALL_KEY, permissions);
