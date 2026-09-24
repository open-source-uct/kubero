import { CanActivate, Injectable, Logger } from '@nestjs/common';

/**
 * Guard de los mensajes del websocket. La autenticación se hace al conectar
 * (EventsGateway.handleConnection) y deja la identidad en `client.data.user`;
 * aquí solo se comprueba que exista y que el JWT no haya caducado desde
 * entonces.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private logger = new Logger(WsJwtGuard.name);

  async canActivate(context: any): Promise<boolean> {
    const client = context.switchToWs().getClient();
    // el cliente puede escribir antes de que termine de autenticarse al
    // conectar (ver EventsGateway.handleConnection): se espera ese resultado
    await client.data?.authentication;
    const user = client.data?.user;
    const expiresAt: number | undefined = client.data?.expiresAt;

    if (!user) {
      this.logger.debug(
        'Message from an unauthenticated socket, disconnecting',
      );
      client.disconnect(true);
      return false;
    }
    if (expiresAt && Date.now() > expiresAt) {
      this.logger.debug('Socket token expired, disconnecting client');
      client.disconnect(true);
      return false;
    }
    return true;
  }
}
