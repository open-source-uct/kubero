export interface AuditEntry {
  // null en los registros de un usuario eliminado; al registrar, null o ''
  // se asignan al usuario de sistema
  user: string | null;
  severity: 'normal' | 'info' | 'warning' | 'critical' | 'error' | 'unknown';
  action: string;
  resource:
    | 'user'
    | 'team'
    | 'role'
    | 'system'
    | 'app'
    | 'pipeline'
    | 'namespace'
    | 'phase'
    | 'unknown'
    | 'build'
    | 'addon'
    | 'settings'
    | 'events'
    | 'security'
    | 'templates'
    | 'config'
    | 'addons'
    | 'console'
    | 'logs'
    | 'reboot'
    | 'audit'
    | 'token';
  namespace: string;
  phase: string;
  app: string;
  pipeline: string;
  message: string;
}
