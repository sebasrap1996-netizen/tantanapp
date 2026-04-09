import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AviatorLoggerWrapper } from '../config/winston.config';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { AviatorHistoryService } from '../logic-apps/Aviator/aviator-history.service';
import { UserSessionService } from '../services/user-session.service';
import { StrategySignal } from '../entities/strategy-signal.entity';

interface AuthenticatedClient {
  socket: Socket;
  userId: string;
  email: string;
  bookmakerId?: number;
  signalSessionActive?: boolean;
}

interface ActiveUser {
  userId: string;
  bookmakerId: number;
  joinedAt: Date;
  email: string;
  signalSessionActive?: boolean;
}

@Injectable()
@WebSocketGateway({
  namespace: '/aviator',
  cors: {
    origin: '*',
  },
})
export class AviatorGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new AviatorLoggerWrapper();
  private connectedClients: Map<string, AuthenticatedClient> = new Map();
  private activeUsers: Map<string, ActiveUser> = new Map();

  constructor(
    private aviatorHistoryService: AviatorHistoryService,
    @Inject(forwardRef(() => UserSessionService))
    private userSessionService: UserSessionService,
  ) {
    // Gateway initialization
  }

  afterInit(server: Server) {
    this.logger.log('Gateway Aviator inicializado (versión básica)');
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const clientData = this.connectedClients.get(client.id);
    if (clientData) {
      // Remover de usuarios activos
      this.activeUsers.delete(clientData.userId);
      this.connectedClients.delete(client.id);
      this.logger.log(`Cliente desconectado: ${client.id}, usuario ${clientData.userId} removido de activos`);
    }
  }

  @SubscribeMessage('joinBookmaker')
  async handleJoinBookmaker(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { bookmakerId: number; count?: number; userId?: string; email?: string },
  ) {
    try {
      const userId = payload.userId || 'temp-user';
      const email = payload.email || 'temp@example.com';
      
      // Verificar si hay sesión activa en la base de datos
      let hasActiveSession = false;
      if (userId !== 'temp-user') {
        try {
          const session = await this.userSessionService.getActiveSession(userId, payload.bookmakerId);
          hasActiveSession = !!session;
          if (hasActiveSession) {
            this.logger.log(`✅ Usuario ${userId} tiene sesión activa en BD para bookmaker ${payload.bookmakerId}`);
          }
        } catch (err) {
          this.logger.warn(`No se pudo verificar sesión activa: ${err.message}`);
        }
      }
      
      // Registrar cliente conectado
      this.connectedClients.set(client.id, {
        socket: client,
        userId,
        email,
        bookmakerId: payload.bookmakerId,
        signalSessionActive: hasActiveSession,
      });

      // Registrar usuario como activo
      this.activeUsers.set(userId, {
        userId,
        bookmakerId: payload.bookmakerId,
        joinedAt: new Date(),
        email,
        signalSessionActive: hasActiveSession,
      });

      // Unirse a la sala del bookmaker
      client.join(`bookmaker:${payload.bookmakerId}`);
      this.logger.log(`Usuario ${userId} se unió al bookmaker ${payload.bookmakerId} - ESTÁ ACTIVO (sesión señales: ${hasActiveSession})`);
      
      // Unirse a sala personal para notificaciones
      client.join(`user:${userId}`);
      
      // Notificar estado de sesión de señales
      client.emit('signal_session_status', { 
        active: hasActiveSession, 
        message: hasActiveSession ? 'Sesión de señales activa' : 'Presiona Empezar para recibir señales'
      });
      
      // Enviar historial inicial al cliente
      try {
        const limit = payload.count || 200;
        const history = await this.aviatorHistoryService.getRecentRounds(payload.bookmakerId, limit);
        
        client.emit('history', {
          bookmakerId: payload.bookmakerId,
          rounds: history
        });
        
        this.logger.log(`Enviados ${history.length} registros de historial a cliente ${client.id}`);
      } catch (historyError) {
        this.logger.error(`Error al obtener historial:`, historyError.message);
        client.emit('history', {
          bookmakerId: payload.bookmakerId,
          rounds: []
        });
      }
      
      return { success: true, message: 'Unido al bookmaker correctamente' };
    } catch (error) {
      this.logger.error(`Error al unir a bookmaker:`, error.message);
      return { success: false, message: 'Error al unir al bookmaker' };
    }
  }

  @SubscribeMessage('leaveBookmaker')
  async handleLeaveBookmaker(
    @ConnectedSocket() client: Socket,
  ) {
    const clientData = this.connectedClients.get(client.id);
    if (clientData) {
      this.activeUsers.delete(clientData.userId);
      if (clientData.bookmakerId) {
        client.leave(`bookmaker:${clientData.bookmakerId}`);
      }
      client.leave(`user:${clientData.userId}`);
      this.logger.log(`Usuario ${clientData.userId} salió del bookmaker - YA NO ESTÁ ACTIVO`);
    }
    return { success: true };
  }

  @SubscribeMessage('getSignalsHistory')
  async handleGetSignalsHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { bookmakerId: number },
  ) {
    try {
      const clientData = this.connectedClients.get(client.id);
      
      // Si no hay datos del cliente, crear un objeto temporal
      const userId = clientData?.userId || 'anonymous';
      
      // Obtener historial: señales del usuario + señales globales (userId = null)
      const signals = await this.userSessionService.getSignalsForUser(payload.bookmakerId, userId, 50);
      client.emit('signals_history', signals);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error al obtener historial de señales:`, error.message);
      return { success: false };
    }
  }

  @SubscribeMessage('startSignals')
  async handleStartSignals(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { bookmakerId: number; userId: string; email: string },
  ) {
    try {
      this.logger.log(`📥 Recibido evento startSignals: ${JSON.stringify(payload)}`);
      
      const { bookmakerId, userId, email } = payload;

      if (!userId || userId === 'temp-user') {
        this.logger.warn(`❌ Usuario no autenticado: userId=${userId}`);
        return { success: false, message: 'Usuario no autenticado' };
      }

      this.logger.log(`✅ Usuario autenticado: ${email} (${userId}) - Bookmaker: ${bookmakerId}`);

      // Iniciar sesión en la base de datos
      await this.userSessionService.startSession(userId, email, bookmakerId);
      this.logger.log(`💾 Sesión guardada en BD para usuario ${email}`);

      // Actualizar estado del cliente
      const clientData = this.connectedClients.get(client.id);
      if (clientData) {
        clientData.signalSessionActive = true;
        this.connectedClients.set(client.id, clientData);
        this.logger.log(`🔄 Cliente ${client.id} actualizado a sesión activa`);
      } else {
        this.logger.warn(`⚠️ No se encontró cliente ${client.id} en connectedClients`);
      }

      // Actualizar estado del usuario activo
      const activeUser = this.activeUsers.get(userId);
      if (activeUser) {
        activeUser.signalSessionActive = true;
        this.activeUsers.set(userId, activeUser);
        this.logger.log(`🔄 Usuario activo ${userId} actualizado a sesión activa`);
      } else {
        this.logger.warn(`⚠️ No se encontró usuario ${userId} en activeUsers`);
      }

      // Notificar al cliente que la sesión está activa
      client.emit('signal_session_status', { 
        active: true, 
        message: 'Sesión iniciada. Recibirás señales ahora.',
        userId,
        bookmakerId
      });

      this.logger.log(`🎯 Usuario ${email} inició sesión de señales en bookmaker ${bookmakerId}`);
      
      return { success: true, message: 'Sesión de señales iniciada' };
    } catch (error) {
      this.logger.error(`Error al iniciar sesión de señales:`, error.message);
      this.logger.error(`Stack trace:`, error.stack);
      return { success: false, message: 'Error al iniciar sesión' };
    }
  }

  @SubscribeMessage('stopSignals')
  async handleStopSignals(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { bookmakerId: number; userId: string },
  ) {
    try {
      const { bookmakerId, userId } = payload;

      // Detener sesión en la base de datos
      await this.userSessionService.stopSession(userId, bookmakerId);

      // Actualizar estado del cliente
      const clientData = this.connectedClients.get(client.id);
      if (clientData) {
        clientData.signalSessionActive = false;
        this.connectedClients.set(client.id, clientData);
      }

      // Actualizar estado del usuario activo
      const activeUser = this.activeUsers.get(userId);
      if (activeUser) {
        activeUser.signalSessionActive = false;
        this.activeUsers.set(userId, activeUser);
      }

      // Notificar al cliente
      client.emit('signal_session_status', { 
        active: false, 
        message: 'Sesión detenida. No recibirás más señales.',
        userId,
        bookmakerId
      });

      this.logger.log(`🛑 Usuario ${userId} detuvo sesión de señales en bookmaker ${bookmakerId}`);
      
      return { success: true, message: 'Sesión de señales detenida' };
    } catch (error) {
      this.logger.error(`Error al detener sesión de señales:`, error.message);
      return { success: false, message: 'Error al detener sesión' };
    }
  }

  // Verificar si un usuario tiene sesión de señales activa
  isUserSignalSessionActive(userId: string, bookmakerId: number): boolean {
    const activeUser = this.activeUsers.get(userId);
    return activeUser?.signalSessionActive === true && activeUser.bookmakerId === bookmakerId;
  }

  // Obtener usuarios con sesión de señales activa en un bookmaker
  getUsersWithActiveSignalSession(bookmakerId: number): ActiveUser[] {
    const allUsers = Array.from(this.activeUsers.values());
    const activeInBookmaker = allUsers.filter(u => u.bookmakerId === bookmakerId);
    const withActiveSession = activeInBookmaker.filter(u => u.signalSessionActive);
    
    this.logger.log(`🔍 [getUsersWithActiveSignalSession] Bookmaker ${bookmakerId}:`);
    this.logger.log(`   Total usuarios activos: ${allUsers.length}`);
    this.logger.log(`   Usuarios en bookmaker ${bookmakerId}: ${activeInBookmaker.length}`);
    this.logger.log(`   Usuarios con sesión activa: ${withActiveSession.length}`);
    
    if (activeInBookmaker.length > 0) {
      activeInBookmaker.forEach(u => {
        this.logger.log(`   - Usuario: ${u.email} | signalSessionActive: ${u.signalSessionActive}`);
      });
    }
    
    return withActiveSession;
  }

  // Método para verificar si un usuario está activo
  isUserActive(userId: string): boolean {
    return this.activeUsers.has(userId);
  }

  // Método para obtener usuarios activos en un bookmaker
  getActiveUsersForBookmaker(bookmakerId: number): ActiveUser[] {
    return Array.from(this.activeUsers.values()).filter(u => u.bookmakerId === bookmakerId);
  }

  // Método para enviar datos a clientes específicos
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Método para enviar datos a todos los clientes de un bookmaker
  sendToBookmaker(bookmakerId: number, event: string, data: any) {
    this.server.to(`bookmaker:${bookmakerId}`).emit(event, data);
  }

  // Emitir multiplicador de prueba
  emitMultiplier(bookmakerId: number, data: any) {
    this.server.to(`bookmaker:${bookmakerId}`).emit('multiplier', data);
  }

  // Emitir datos de ronda de prueba
  emitRoundData(bookmakerId: number, data: any) {
    this.server.to(`bookmaker:${bookmakerId}`).emit('round', data);
  }

  // Emitir datos RAW de aviator
  emitAviatorRaw(bookmakerId: number, data: any) {
    this.server.to(`bookmaker:${bookmakerId}`).emit('aviator_raw', data);
  }

  // Emitir predicción/señal de estrategia
  emitPrediction(bookmakerId: number, data: any) {
    this.server.to(`bookmaker:${bookmakerId}`).emit('prediction', data);
    this.logger.log(`📡 Predicción emitida a bookmaker ${bookmakerId}: ${data.bookmakerName || data.strategy} - ${data.apostar}`);
  }

  // Emitir historial de señales
  emitSignalsHistory(bookmakerId: number, signals: any[]) {
    this.server.to(`bookmaker:${bookmakerId}`).emit('signals_history', signals);
  }

  // Emitir actualización de créditos a un usuario específico
  emitCreditsUpdate(userId: string, data: { balance: number; totalEarned: number; totalSpent: number }) {
    this.server.to(`user:${userId}`).emit('credits_update', data);
    this.logger.log(`💰 Créditos actualizados emitidos a usuario ${userId}: ${data.balance}`);
  }

  // Obtener estadísticas de conexiones
  getConnectionStats() {
    return {
      connectedClients: this.connectedClients.size,
      activeUsers: this.activeUsers.size,
      bookmakers: Array.from(this.activeUsers.values()).map(c => c.bookmakerId).filter(Boolean),
    };
  }

  // Método para obtener el servidor Socket.IO
  getServer(): Server {
    return this.server;
  }

  // Limpiar conexiones huérfanas
  cleanupOrphanedConnections() {
    const cleaned: string[] = [];
    for (const [clientId, clientData] of this.connectedClients.entries()) {
      if (!clientData.socket.connected) {
        this.connectedClients.delete(clientId);
        this.activeUsers.delete(clientData.userId);
        cleaned.push(clientId);
      }
    }
    return { cleaned };
  }

}
