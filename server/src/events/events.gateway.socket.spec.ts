import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { Server } from 'socket.io';
import { io as connect, Socket as ClientSocket } from 'socket.io-client';
import { EventsGateway } from './events.gateway';
import { WsJwtGuard } from '../auth/strategies/ws-jwt.guard';

/**
 * Prueba con sockets REALES (servidor y clientes socket.io), para comprobar lo
 * que los mocks no cubren: que un socket sin sesión se desconecta, que los
 * eventos de un pipeline solo llegan a sus equipos y que no se puede entrar a
 * la sala ni escribir en la consola de otro equipo.
 */

const USERS: Record<string, any> = {
  'tok-taller1': {
    userId: 'u1',
    username: 'ana',
    role: 'student',
    userGroups: ['Taller1'],
    permissions: ['app:write', 'console:ok', 'logs:ok'],
  },
  'tok-taller2': {
    userId: 'u2',
    username: 'luis',
    role: 'student',
    userGroups: ['Taller2'],
    permissions: ['app:write', 'console:ok', 'logs:ok'],
  },
  'tok-admin': {
    userId: 'u3',
    username: 'root',
    role: 'admin',
    userGroups: ['admin'],
    permissions: ['app:write', 'console:ok', 'logs:ok'],
  },
};

// el pipeline 'p1' es del equipo Taller1
const PIPELINES = [{ name: 'p1', phases: [{ name: 'production' }] }];

describe('EventsGateway with real sockets', () => {
  let http: HttpServer;
  let io: Server;
  let gateway: EventsGateway;
  let url: string;
  const clients: ClientSocket[] = [];
  const write = jest.fn();

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // conecta y devuelve el socket junto con lo que va recibiendo
  const open = async (token?: string) => {
    const socket = connect(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: token ? { token } : {},
    });
    clients.push(socket);
    const received: Array<{ event: string; data: any }> = [];
    const state = { disconnectReason: undefined as string | undefined };
    socket.onAny((event, data) => received.push({ event, data }));
    socket.on('disconnect', (reason) => (state.disconnectReason = reason));
    await new Promise<void>((resolve) => {
      socket.on('connect', () => resolve());
      socket.on('disconnect', () => resolve());
      socket.on('connect_error', () => resolve());
    });
    await wait(150); // deja que el server termine de autenticar
    return { socket, received, state };
  };

  beforeAll(async () => {
    const jwt = {
      verify: (token: string) => {
        if (!USERS[token]) throw new Error('invalid token');
        return { userId: USERS[token].userId, exp: 4e9 };
      },
    };
    const identity = {
      resolve: async (payload: any) => {
        // la BD real tarda: sin latencia la carrera con el primer mensaje del
        // cliente no se reproduce
        await new Promise((r) => setTimeout(r, 80));
        return Object.values(USERS).find((u) => u.userId === payload.userId);
      },
    };
    const pipelines = {
      listPipelines: async (groups: string[]) => ({
        items: groups.includes('admin')
          ? PIPELINES
          : groups.includes('Taller1')
            ? PIPELINES
            : [],
      }),
    };
    gateway = new EventsGateway(
      jwt as any,
      identity as any,
      {
        get: () => pipelines,
      } as any,
    );

    http = createServer();
    io = new Server(http, { cors: { origin: '*' } });
    gateway.server = io;
    const guard = new WsJwtGuard();
    // Igual que Nest: cada mensaje pasa primero por el guard del gateway
    const guarded =
      (socket: any, handler: (d: any, s: any) => Promise<void>) =>
      async (data: any) => {
        const ok = await guard.canActivate({
          switchToWs: () => ({ getClient: () => socket }),
        });
        if (ok) await handler(data, socket);
      };
    io.on('connection', (socket) => {
      void gateway.handleConnection(socket);
      socket.on(
        'join',
        (d) => void guarded(socket, (x, s) => gateway.handleJoin(x, s))(d),
      );
      socket.on(
        'leave',
        (d) => void guarded(socket, (x, s) => gateway.handleLeave(x, s))(d),
      );
      socket.on(
        'terminal',
        (d) => void guarded(socket, (x, s) => gateway.handleTerminal(x, s))(d),
      );
    });
    await new Promise<void>((resolve) => http.listen(0, resolve));
    url = `http://localhost:${(http.address() as AddressInfo).port}`;

    gateway.execStreams['p1-production-web-pod-c-terminal'] = {
      websocket: {} as any,
      stream: { write },
    };
  });

  afterAll(async () => {
    clients.forEach((c) => c.close());
    await io.close();
  });

  beforeEach(() => write.mockClear());

  it('disconnects a socket that connects without a token and sends it nothing', async () => {
    const anon = await open();
    expect(anon.state.disconnectReason).toBe('io server disconnect');
    gateway.sendEvent('newApp', { secret: 'data' });
    await wait(150);
    expect(anon.received).toEqual([]);
  });

  it('disconnects a socket with an invalid token', async () => {
    const bad = await open('not-a-token');
    expect(bad.state.disconnectReason).toBe('io server disconnect');
  });

  it('does not disconnect a valid user who writes right after connecting (race with the authentication)', async () => {
    const socket = connect(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: { token: 'tok-taller1' },
    });
    clients.push(socket);
    let reason: string | undefined;
    socket.on('disconnect', (r) => (reason = r));
    // sin esperar: el mismo instante en que conecta, como hace la pantalla de logs
    socket.on('connect', () =>
      socket.emit('join', { room: 'p1-production-web' }),
    );
    await wait(400);
    expect(reason).toBeUndefined();
    expect(socket.connected).toBe(true);
    gateway.sendLogline('p1-production-web', { log: 'x' });
    const got: string[] = [];
    socket.onAny((e) => got.push(e));
    gateway.sendLogline('p1-production-web', { log: 'y' });
    await wait(200);
    expect(got).toContain('log');
  });

  it('keeps authenticated sockets connected', async () => {
    const ana = await open('tok-taller1');
    expect(ana.socket.connected).toBe(true);
    expect(ana.state.disconnectReason).toBeUndefined();
  });

  it('delivers an event of a pipeline only to its team and to admin', async () => {
    const ana = await open('tok-taller1'); // Taller1: dueña del pipeline
    const luis = await open('tok-taller2'); // Taller2: ajena
    const root = await open('tok-admin');

    gateway.sendEvent('deleteApp', { message: 'Deleted pipeline: p1' }, [
      'Taller1',
    ]);
    await wait(200);

    expect(ana.received.map((r) => r.event)).toContain('deleteApp');
    expect(root.received.map((r) => r.event)).toContain('deleteApp');
    // esto es lo que se veía antes: el aviso le llegaba a todos
    expect(luis.received).toEqual([]);
  });

  it('a system event (no teams) reaches only the admin team', async () => {
    const ana = await open('tok-taller1');
    const root = await open('tok-admin');
    gateway.sendEvent('updateSettings', { x: 1 }, []);
    await wait(200);
    expect(root.received.map((r) => r.event)).toContain('updateSettings');
    expect(ana.received).toEqual([]);
  });

  it('an event without team restriction reaches every authenticated socket', async () => {
    const ana = await open('tok-taller1');
    const luis = await open('tok-taller2');
    gateway.sendEvent('newPipeline', { open: true });
    await wait(200);
    expect(ana.received.map((r) => r.event)).toContain('newPipeline');
    expect(luis.received.map((r) => r.event)).toContain('newPipeline');
  });

  it('logs of a pipeline only reach the sockets that could join its room', async () => {
    const ana = await open('tok-taller1');
    const luis = await open('tok-taller2');
    ana.socket.emit('join', { room: 'p1-production-web' });
    luis.socket.emit('join', { room: 'p1-production-web' }); // sala ajena
    await wait(300);

    gateway.sendLogline('p1-production-web', { log: 'private line' });
    await wait(200);

    expect(ana.received.map((r) => r.event)).toContain('log');
    expect(luis.received).toEqual([]);
  });

  it('does not let another team type into a console that is open', async () => {
    const luis = await open('tok-taller2');
    luis.socket.emit('terminal', {
      room: 'p1-production-web-pod-c-terminal',
      data: 'rm -rf /\r',
    });
    await wait(300);
    expect(write).not.toHaveBeenCalled();
  });

  it('lets the owning team type into its console', async () => {
    const ana = await open('tok-taller1');
    ana.socket.emit('terminal', {
      room: 'p1-production-web-pod-c-terminal',
      data: 'ls\r',
    });
    await wait(300);
    expect(write).toHaveBeenCalledWith('ls\r');
  });
});
