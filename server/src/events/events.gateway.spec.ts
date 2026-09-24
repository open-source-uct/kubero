import { EventsGateway } from './events.gateway';
import { Server, Socket } from 'socket.io';

const user = (over: any = {}) => ({
  userId: 'u1',
  username: 'ana',
  role: 'member',
  userGroups: ['Taller1'],
  permissions: ['app:write', 'console:ok', 'logs:ok'],
  ...over,
});

// pipelines que existen en el cluster y quién tiene acceso a cuáles
const ALL = [
  { name: 'mine', phases: [{ name: 'production' }, { name: 'stage' }] },
  { name: 'theirs', phases: [{ name: 'production' }] },
  { name: 'a', phases: [{ name: 'b' }] },
  { name: 'a-b', phases: [{ name: 'production' }] },
];

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let mockServer: any;
  let jwt: { verify: jest.Mock };
  let identity: { resolve: jest.Mock };
  let pipelines: { listPipelines: jest.Mock };

  const socketOf = (u: any, extra: any = {}): any => ({
    data: { user: u },
    handshake: { headers: {}, auth: {} },
    join: jest.fn(),
    leave: jest.fn(),
    disconnect: jest.fn(),
    ...extra,
  });

  beforeEach(() => {
    mockServer = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    };
    jwt = { verify: jest.fn().mockReturnValue({ userId: 'u1', exp: 4e9 }) };
    identity = { resolve: jest.fn().mockResolvedValue(user()) };
    pipelines = {
      // el usuario solo tiene acceso a 'mine'; ['admin'] ve todos
      listPipelines: jest.fn().mockImplementation(async (groups: string[]) => ({
        items: groups.includes('admin')
          ? ALL
          : ALL.filter((p) => p.name === 'mine'),
      })),
    };
    gateway = new EventsGateway(
      jwt as any,
      identity as any,
      {
        get: () => pipelines,
      } as any,
    );
    gateway.server = mockServer as Server;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('disconnects a socket without token', async () => {
      const client = socketOf(undefined);
      await gateway.handleConnection(client as Socket);
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('disconnects a socket with an invalid token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });
      const client = socketOf(undefined, {
        handshake: { headers: {}, auth: { token: 'bad' } },
      });
      await gateway.handleConnection(client as Socket);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects when the user is disabled or deleted', async () => {
      identity.resolve.mockRejectedValue(new Error('Unauthorized'));
      const client = socketOf(undefined, {
        handshake: { headers: {}, auth: { token: 't' } },
      });
      await gateway.handleConnection(client as Socket);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('authenticates with the token and puts the socket in its team rooms', async () => {
      identity.resolve.mockResolvedValue(
        user({ userGroups: ['Taller1', 'Taller2'] }),
      );
      const client = socketOf(undefined, {
        handshake: { headers: {}, auth: { token: 't' } },
      });
      await gateway.handleConnection(client as Socket);
      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data.user.username).toBe('ana');
      expect(client.join).toHaveBeenCalledWith('team:Taller1');
      expect(client.join).toHaveBeenCalledWith('team:Taller2');
    });

    it('accepts the token in the Authorization header too', async () => {
      const client = socketOf(undefined, {
        handshake: { headers: { authorization: 'Bearer abc' }, auth: {} },
      });
      await gateway.handleConnection(client as Socket);
      expect(jwt.verify).toHaveBeenCalledWith('abc');
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleJoin', () => {
    it('lets a team join the logs room of its own pipeline', async () => {
      const client = socketOf(user());
      await gateway.handleJoin({ room: 'mine-production-web' }, client);
      expect(client.join).toHaveBeenCalledWith('mine-production-web');
    });

    it("refuses another team's logs room", async () => {
      const client = socketOf(user());
      await gateway.handleJoin({ room: 'theirs-production-web' }, client);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('refuses a room that belongs to no pipeline', async () => {
      const client = socketOf(user());
      await gateway.handleJoin({ room: 'nothing-here-x' }, client);
      await gateway.handleJoin({ room: 'team:admin' }, client);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('refuses a room name that is ambiguous with a pipeline of another team', async () => {
      // 'a-b-production-x' encaja con el pipeline 'a-b' (ajeno) y no con 'a'
      const client = socketOf(user());
      await gateway.handleJoin({ room: 'a-b-production-x' }, client);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('refuses malformed rooms', async () => {
      const client = socketOf(user());
      await gateway.handleJoin({ room: undefined as any }, client);
      await gateway.handleJoin({ room: 42 as any }, client);
      await gateway.handleJoin({ room: '' }, client);
      await gateway.handleJoin({ room: 'x'.repeat(500) }, client);
      await gateway.handleJoin(undefined as any, client);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('requires logs:ok for a logs room', async () => {
      const client = socketOf(user({ permissions: ['app:write'] }));
      await gateway.handleJoin({ room: 'mine-production-web' }, client);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('requires app:write and console:ok for a terminal room', async () => {
      const room = 'mine-production-web-pod1-c1-terminal';
      const noConsole = socketOf(user({ permissions: ['app:write'] }));
      await gateway.handleJoin({ room }, noConsole);
      expect(noConsole.join).not.toHaveBeenCalled();

      const allowed = socketOf(user());
      await gateway.handleJoin({ room }, allowed);
      expect(allowed.join).toHaveBeenCalledWith(room);
    });

    it("refuses another team's terminal room even with console permissions", async () => {
      const client = socketOf(user());
      await gateway.handleJoin(
        { room: 'theirs-production-web-pod1-c1-terminal' },
        client,
      );
      expect(client.join).not.toHaveBeenCalled();
    });

    it('lets the admin team join any pipeline room', async () => {
      const client = socketOf(user({ userGroups: ['admin'] }));
      await gateway.handleJoin({ room: 'theirs-production-web' }, client);
      expect(client.join).toHaveBeenCalledWith('theirs-production-web');
    });
  });

  describe('handleLeave', () => {
    it('should leave a room', async () => {
      const client = socketOf(user());
      await gateway.handleLeave({ room: 'room1' }, client);
      expect(client.leave).toHaveBeenCalledWith('room1');
    });

    it('ignores a malformed room', async () => {
      const client = socketOf(user());
      await gateway.handleLeave({ room: 5 as any }, client);
      expect(client.leave).not.toHaveBeenCalled();
    });
  });

  describe('handleTerminal', () => {
    const write = jest.fn();
    const room = 'mine-production-web-pod1-c1-terminal';

    beforeEach(() => {
      write.mockClear();
      gateway.execStreams[room] = { websocket: {} as any, stream: { write } };
      gateway.execStreams['theirs-production-web-pod1-c1-terminal'] = {
        websocket: {} as any,
        stream: { write },
      };
    });

    it("writes to the console of the user's own pipeline", async () => {
      await gateway.handleTerminal({ room, data: 'ls\r' }, socketOf(user()));
      expect(write).toHaveBeenCalledWith('ls\r');
    });

    it("does NOT write into another team's console", async () => {
      await gateway.handleTerminal(
        {
          room: 'theirs-production-web-pod1-c1-terminal',
          data: 'rm -rf /\r',
        },
        socketOf(user()),
      );
      expect(write).not.toHaveBeenCalled();
    });

    it('does not write without console permissions (guest role)', async () => {
      await gateway.handleTerminal(
        { room, data: 'ls\r' },
        socketOf(user({ permissions: ['app:read', 'logs:ok'] })),
      );
      expect(write).not.toHaveBeenCalled();
    });

    it('ignores input for a stream that does not exist', async () => {
      await gateway.handleTerminal(
        { room: 'mine-production-web-ghost-c1-terminal', data: 'x' },
        socketOf(user()),
      );
      expect(write).not.toHaveBeenCalled();
    });
  });

  describe('sendEvent', () => {
    it('emits to every authenticated socket when no teams are given', () => {
      gateway.sendEvent('testEvent', { foo: 'bar' });
      expect(mockServer.emit).toHaveBeenCalledWith('testEvent', { foo: 'bar' });
      expect(mockServer.to).not.toHaveBeenCalled();
    });

    it('emits only to the given teams and to the admin team', () => {
      gateway.sendEvent('deleteApp', { a: 1 }, ['Taller1']);
      expect(mockServer.to).toHaveBeenCalledWith([
        'team:admin',
        'team:Taller1',
      ]);
      expect(mockServer.emit).toHaveBeenCalledWith('deleteApp', { a: 1 });
    });

    it('with an empty team list only the admin team receives it', () => {
      gateway.sendEvent('updateSettings', {}, []);
      expect(mockServer.to).toHaveBeenCalledWith(['team:admin']);
    });
  });

  it('should emit logline to room on sendLogline', () => {
    gateway.sendLogline('room1', 'logline');
    expect(mockServer.to).toHaveBeenCalledWith('room1');
    expect(mockServer.emit).toHaveBeenCalledWith('log', 'logline');
  });

  it('should emit terminal line to room on sendTerminalLine', () => {
    gateway.sendTerminalLine('room1', 'line');
    expect(mockServer.to).toHaveBeenCalledWith('room1');
    expect(mockServer.emit).toHaveBeenCalledWith('consoleresponse', 'line');
  });
});
