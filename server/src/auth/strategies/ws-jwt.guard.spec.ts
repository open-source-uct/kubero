import { WsJwtGuard } from './ws-jwt.guard';

describe('WsJwtGuard', () => {
  const guard = new WsJwtGuard();

  const ctxOf = (data: any) => {
    const client = { data, disconnect: jest.fn() };
    return {
      client,
      context: { switchToWs: () => ({ getClient: () => client }) },
    };
  };

  it('lets messages of an authenticated socket through', async () => {
    const { client, context } = ctxOf({ user: { userId: 'u1' } });
    expect(await guard.canActivate(context)).toBe(true);
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('rejects and disconnects a socket that never authenticated', async () => {
    const { client, context } = ctxOf({});
    expect(await guard.canActivate(context)).toBe(false);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('rejects and disconnects a socket whose token expired after connecting', async () => {
    const { client, context } = ctxOf({
      user: { userId: 'u1' },
      expiresAt: Date.now() - 1000,
    });
    expect(await guard.canActivate(context)).toBe(false);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('waits for the authentication that is still in progress instead of rejecting the socket', async () => {
    // el cliente manda `join` antes de que el server termine de verificar el
    // token: sin esperar, un usuario válido era desconectado
    const data: any = {};
    data.authentication = new Promise<void>((resolve) =>
      setTimeout(() => {
        data.user = { userId: 'u1' };
        resolve();
      }, 30),
    );
    const { client, context } = ctxOf(data);
    expect(await guard.canActivate(context)).toBe(true);
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('rejects when the authentication in progress ends without a user', async () => {
    const data: any = {};
    data.authentication = new Promise<void>((resolve) =>
      setTimeout(resolve, 30),
    );
    const { client, context } = ctxOf(data);
    expect(await guard.canActivate(context)).toBe(false);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('accepts a socket whose token has not expired yet', async () => {
    const { context } = ctxOf({
      user: { userId: 'u1' },
      expiresAt: Date.now() + 60_000,
    });
    expect(await guard.canActivate(context)).toBe(true);
  });
});
