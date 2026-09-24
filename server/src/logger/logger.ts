import { ConsoleLogger } from '@nestjs/common';

/**
 * A custom logger that disables all logs emitted by calling `log` method if
 * they use one of the following contexts:
 * - `InstanceLoader`
 * - `RoutesResolver`
 * - `RouterExplorer`
 * - `NestFactory`
 */
export class CustomConsoleLogger extends ConsoleLogger {
  static contextsToIgnore = [
    'InstanceLoader',
    'RoutesResolver',
    'RouterExplorer',
    'NestFactory',
    'NestApplication',
    'WebSocketsController',
  ];

  log(message: any, ...optionalParams: any[]): void {
    const context = optionalParams[0] || '';
    if (!CustomConsoleLogger.contextsToIgnore.includes(context)) {
      super.log(message, ...optionalParams);
    }
  }
}
