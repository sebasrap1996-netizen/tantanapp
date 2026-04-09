import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { UserBettingService } from '../services/user-betting/user-betting.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  namespace: '/user-betting',
})
@Injectable()
export class UserBettingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(UserBettingGateway.name);
  private userSessions: Map<string, Set<string>> = new Map(); // userId -> Set of sessionIds

  constructor(
    private bettingService: UserBettingService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Extraer token del handshake
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        client.emit('error', { message: 'No token provided' });
        client.disconnect();
        return;
      }

      // Verificar token
      const payload = this.jwtService.verify(token);
      (client as any).userId = payload.id || payload.sub;
      
      this.logger.log(`👤 User ${(client as any).userId} connected to betting gateway`);
      
      // Enviar estado actual
      const activeSessions = await this.bettingService.getActiveSessions((client as any).userId);
      client.emit('active-sessions', activeSessions);
      
    } catch (error: any) {
      this.logger.error(`Connection error: ${error.message}`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = (client as any).userId;
    if (userId) {
      this.userSessions.delete(userId);
      this.logger.log(`👤 User ${userId} disconnected from betting gateway`);
    }
  }

  // ========== SESSION EVENTS ==========

  @SubscribeMessage('start-session')
  async handleStartSession(client: Socket, data: { sessionId: string }) {
    try {
      const userId = (client as any).userId;
      const session = await this.bettingService.startSession(userId, data.sessionId);
      
      // Unir al usuario a la sala de la sesión
      client.join(`session:${data.sessionId}`);
      
      // Guardar en el mapa
      if (!this.userSessions.has(userId)) {
        this.userSessions.set(userId, new Set());
      }
      this.userSessions.get(userId)!.add(data.sessionId);
      
      client.emit('session-started', session);
      return { success: true, session };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('pause-session')
  async handlePauseSession(client: Socket, data: { sessionId: string }) {
    try {
      const userId = (client as any).userId;
      const session = await this.bettingService.pauseSession(userId, data.sessionId);
      client.emit('session-paused', session);
      return { success: true, session };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('stop-session')
  async handleStopSession(client: Socket, data: { sessionId: string }) {
    try {
      const userId = (client as any).userId;
      const session = await this.bettingService.stopSession(userId, data.sessionId);
      
      // Salir de la sala
      client.leave(`session:${data.sessionId}`);
      
      // Remover del mapa
      this.userSessions.get(userId)?.delete(data.sessionId);
      
      client.emit('session-stopped', session);
      return { success: true, session };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('get-session-status')
  async handleGetSessionStatus(client: Socket, data: { sessionId: string }) {
    try {
      const userId = (client as any).userId;
      const session = await this.bettingService.getSessionStatus(userId, data.sessionId);
      return { success: true, session };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ========== BETTING EVENTS ==========

  @SubscribeMessage('place-bet')
  async handlePlaceBet(client: Socket, data: { sessionId: string; signalId?: string; strategyName?: string }) {
    try {
      const history = await this.bettingService.placeBet(data.sessionId, data.signalId, data.strategyName);
      
      // Notificar a todos en la sala de la sesión
      this.server.to(`session:${data.sessionId}`).emit('bet-placed', history);
      
      return { success: true, bet: history };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ========== PUBLIC METHODS ==========

  /**
   * Emite un resultado de apuesta a una sesión
   */
  emitBetResult(sessionId: string, result: any) {
    this.server.to(`session:${sessionId}`).emit('bet-result', result);
  }

  /**
   * Emite actualización de balance
   */
  emitBalanceUpdate(sessionId: string, balance: number, profit: number) {
    this.server.to(`session:${sessionId}`).emit('balance-update', { balance, profit });
  }

  /**
   * Emite una señal detectada a los usuarios con sesiones activas en ese bookmaker
   */
  async emitSignalToBookmakerUsers(bookmakerId: number, signal: any) {
    // Buscar sesiones activas para este bookmaker
    // Por ahora emitimos a todos los usuarios conectados
    this.server.emit('signal-detected', { bookmakerId, signal });
  }

  /**
   * Emite evento de sesión detenida a un usuario específico
   */
  emitSessionStopped(userId: string, session: any) {
    this.server.emit('session-stopped', session);
  }
}
