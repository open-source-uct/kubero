import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ModuleRef } from '@nestjs/core';
import { WsJwtGuard } from '../auth/strategies/ws-jwt.guard';
import { AuthenticatedUser, IdentityService } from '../auth/identity.service';

// Sala del equipo: los eventos de un pipeline solo llegan a sus equipos
const teamRoom = (team: string) => `team:${team}`;

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@UseGuards(WsJwtGuard)
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;
  public execStreams: { [key: string]: { websocket: WebSocket; stream: any } } =
    {};
  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly identity: IdentityService,
    private readonly moduleRef: ModuleRef,
  ) {}

  // Se autentica al conectar. Antes cualquiera podía conectarse y recibir todos
  // los eventos emitidos a todos (el guard solo protegía los mensajes que el
  // cliente enviaba).
  async handleConnection(client: Socket) {
    // La promesa se guarda en el socket: el cliente puede mandar un mensaje
    // (por ejemplo `join`) antes de que termine la verificación del token y la
    // consulta a la BD, y el guard tiene que esperarla en vez de tomar el
    // socket por no autenticado y desconectarlo.
    client.data.authentication = this.authenticate(client);
    await client.data.authentication;
  }

  // Nunca rechaza: si algo falla desconecta el socket.
  private async authenticate(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error('No token provided');
      }
      const payload = this.jwtService.verify(token);
      const user = await this.identity.resolve(payload);
      client.data.user = user;
      // el JWT caduca: pasado ese momento el socket deja de ser válido
      client.data.expiresAt = payload.exp ? payload.exp * 1000 : undefined;
      // el equipo admin ve todo; el resto, solo los de sus equipos
      for (const team of user.userGroups) {
        await client.join(teamRoom(team));
      }
    } catch (error) {
      this.logger.debug('Socket rejected: ' + (error?.message ?? error));
      client.disconnect(true);
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }
    return client.handshake.auth?.token || null;
  }

  // El pipeline y la fase salen del nombre de la sala (<pipeline>-<fase>-<app>
  // y <pipeline>-<fase>-<app>-<pod>-<contenedor>-terminal). Como los nombres
  // pueden llevar guiones, se buscan TODOS los pipelines/fases que encajan con
  // el prefijo y solo se autoriza si el usuario tiene acceso a todos ellos:
  // ante una sala ambigua entre un pipeline propio y uno ajeno, se deniega.
  async canAccessRoom(
    user: AuthenticatedUser,
    room: unknown,
  ): Promise<boolean> {
    if (typeof room !== 'string' || room.length === 0 || room.length > 300) {
      return false;
    }
    const isTerminal = room.endsWith('-terminal');
    const needed = isTerminal ? ['app:write', 'console:ok'] : ['logs:ok'];
    if (!needed.every((p) => user.permissions.includes(p))) {
      return false;
    }

    // import diferido: PipelinesService -> NotificationsService -> EventsGateway
    // forma un ciclo de archivos si se importa arriba y Nest ve la clase undefined
    const { PipelinesService } = await import('../pipelines/pipelines.service');
    const pipelines = this.moduleRef.get(PipelinesService, { strict: false });
    const all = await pipelines.listPipelines(['admin']);
    const owners = all.items.filter((p) =>
      p.phases.some((ph) => room.startsWith(`${p.name}-${ph.name}-`)),
    );
    if (owners.length === 0) {
      return false;
    }
    if (user.userGroups.includes('admin')) {
      return true;
    }
    const mine = await pipelines.listPipelines(user.userGroups);
    const accessible = new Set(mine.items.map((p) => p.name));
    return owners.every((p) => accessible.has(p.name));
  }

  @SubscribeMessage('join')
  async handleJoin(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    //Logger.debug('joining room ' + data.room);
    if (!(await this.canAccessRoom(client.data.user, data?.room))) {
      this.logger.warn(
        `User ${client.data.user?.username} denied joining room ${data?.room}`,
      );
      return;
    }
    await client.join(data.room);
  }

  @SubscribeMessage('leave')
  async handleLeave(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    //Logger.debug('leaving room ' + data.room);
    if (typeof data?.room === 'string') {
      await client.leave(data.room);
    }
  }

  // `teams` limita quién recibe el evento: solo esos equipos y el equipo admin.
  // Sin `teams` llega a todos los usuarios autenticados.
  sendEvent(event: string, data: any, teams?: string[]) {
    if (!teams) {
      this.server.emit(event, data);
      return;
    }
    const rooms = ['admin', ...teams].map(teamRoom);
    this.server.to(rooms).emit(event, data);
  }

  sendLogline(room: string, logline: any) {
    //TODO define logline type
    this.server.to(room).emit('log', logline);
  }

  // sending the terminal input to the server
  // Antes cualquiera podía escribir en la consola abierta de otro equipo
  // conociendo el nombre de la sala.
  @SubscribeMessage('terminal')
  async handleTerminal(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    if (!this.execStreams[data?.room]) {
      return;
    }
    if (!(await this.canAccessRoom(client.data.user, data.room))) {
      this.logger.warn(
        `User ${client.data.user?.username} denied writing to terminal ${data.room}`,
      );
      return;
    }
    this.execStreams[data.room].stream.write(data.data);
  }

  // sending the terminal output to the client
  sendTerminalLine(room: string, line: string) {
    this.server.to(room).emit('consoleresponse', line);
  }
}
