import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { WebSocket } from 'ws';
import { Bookmaker } from '../../entities/bookmaker.entity';
import { UserBettingSession } from '../../entities/user-betting-session.entity';
import { decodeMessage } from '../../logic-apps/Aviator/decoder';
import { createHistoryRequestMessage, createAuthMessage, createSpribeAuthMessage } from '../../logic-apps/Aviator/encoder';
import { AviatorWs } from '../../entities/aviator-ws.entity';
import { UserBookmakerAuth } from '../../entities/user-bookmaker-auth.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

interface ActiveConnection {
  sessionId: string;
  ws: WebSocket;
  status: 'CONNECTING' | 'CONNECTED' | 'BETTING' | 'WAITING' | 'DISCONNECTED';
  balance: number;
  lastPing: Date;
  authToken?: string;
  sessionToken?: string;
  bookmakerId: number;
  userId: string;
  lastHistoryRequest?: Date;
}

// Callbacks para eventos
type HistoryCallback = (sessionId: string, historyData: any) => void;

@Injectable()
export class UserBettingWebSocketService implements OnModuleDestroy {
  private readonly logger = new Logger(UserBettingWebSocketService.name);
  private connections: Map<string, ActiveConnection> = new Map();
  private historyCallbacks: Map<string, HistoryCallback[]> = new Map();

  constructor(
    @InjectRepository(AviatorWs)
    private aviatorWsRepo: Repository<AviatorWs>,
    @InjectRepository(UserBookmakerAuth)
    private userAuthRepo: Repository<UserBookmakerAuth>,
  ) {}

  async onModuleDestroy() {
    // Cerrar todas las conexiones al destruir el módulo
    for (const [sessionId, conn] of this.connections) {
      if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.close(1000, 'Server shutdown');
      }
    }
    this.connections.clear();
  }

  /**
   * Obtiene el auth message apropiado para una sesión de apuestas
   * Ahora siempre usa la configuración global proporcionada por el administrador en Bookmaker
   */
  async getAuthMessageForSession(auth: UserBookmakerAuth): Promise<string | null> {
    this.logger.log(`🔑 Using global admin auth message for bookmaker ${auth.bookmakerId}`);
    
    // Buscar la configuración global del bookmaker
    const bookmaker = await this.userAuthRepo.manager.findOne(Bookmaker, {
      where: { id: auth.bookmakerId }
    });

    if (bookmaker && bookmaker.authMessage) {
      return bookmaker.authMessage;
    }

    // Si no está en bookmaker, intentar en aviator_ws
    const config = await this.aviatorWsRepo.findOne({
      where: { bookmakerId: auth.bookmakerId, gameId: 1 },
    });

    if (config && config.auth_message) {
      return config.auth_message;
    }

    this.logger.error('No hay mensaje de autenticación global configurado para este casino');
    return null;
  }

  /**
   * Prueba la conexión usando los datos de autenticación globales
   */
  async testConnectionWithAuth(
    auth: UserBookmakerAuth,
    bookmaker: Bookmaker
  ): Promise<{ success: boolean; error?: string; balance?: number; currency?: string; username?: string; playerId?: string }> {
    // Obtener el auth message apropiado
    const authMessage = await this.getAuthMessageForSession(auth);
    
    if (!authMessage) {
      return { success: false, error: 'No hay método de autenticación configurado' };
    }

    return this.testConnection(bookmaker, authMessage);
  }

  /**
   * Prueba la conexión con un auth message
   */
  async testConnection(
    bookmaker: Bookmaker,
    authMessage: string
  ): Promise<{ success: boolean; error?: string; balance?: number; currency?: string; username?: string; playerId?: string }> {
    return new Promise(async (resolve) => {
      try {
        // Obtener configuración global del bookmaker (solo URL y API message)
        const config = await this.aviatorWsRepo.findOne({
          where: { bookmakerId: bookmaker.id, gameId: 1 },
        });

        if (!config) {
          return resolve({ success: false, error: 'Bookmaker no configurado para Aviator' });
        }

        const wsUrl = config.url_websocket;
        const apiMessage = config.api_message;

        // Usar SOLO el auth message proporcionado por el usuario
        if (!authMessage) {
          return resolve({ success: false, error: 'No hay auth_message. Captura el mensaje del WebSocket.' });
        }
        
        this.logger.log(`📋 Using user auth message`);

        const headers = {
          Pragma: 'no-cache',
          'Cache-Control': 'no-cache',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Origin: bookmaker.bookmakerUrl || 'https://888starz.bet',
        };

        const ws = new WebSocket(wsUrl, [], { headers });
        let resolved = false;

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            ws.close();
            resolve({ success: false, error: 'Connection timeout' });
          }
        }, 15000);

        ws.on('open', () => {
          this.logger.log(`✅ Test connection opened for bookmaker ${bookmaker.id}`);
          // Enviar API message
          ws.send(Buffer.from(apiMessage, 'base64'));
        });

        ws.on('message', (data: Buffer) => {
          try {
            const decoded = decodeMessage(data);
            if (!decoded) return;

            // Enviar auth después del handshake
            if (decoded.a === 0 && decoded.c === 0 && !resolved) {
              ws.send(Buffer.from(authMessage, 'base64'));
              this.logger.log(`📤 Auth message sent for test`);
            }

            // Verificar respuesta de auth
            if (decoded.a === 1 && decoded.c === 0 && decoded.p) {
              clearTimeout(timeout);
              resolved = true;
              ws.close();

              // Log completo de la respuesta para debugging
              this.logger.log(`📥 Auth response: ${JSON.stringify(decoded.p, null, 2)}`);

              // Verificar autenticación exitosa - puede tener token O datos de usuario
              const hasToken = decoded.p.token || decoded.p.sessionToken;
              const hasUserData = decoded.p.un !== undefined && decoded.p.pi !== undefined;
              
              if (hasToken || hasUserData) {
                this.logger.log(`✅ Auth successful for bookmaker ${bookmaker.id} - User: ${decoded.p.un}`);
                
                // Extraer moneda del username si tiene formato "id&&bookmaker"
                let currency = 'USD';
                if (decoded.p.zn && decoded.p.zn.length <= 10) {
                  currency = decoded.p.zn;
                }
                
                resolve({
                  success: true,
                  balance: decoded.p.balance || decoded.p.bal || decoded.p.rs || 0,
                  currency: currency,
                  username: decoded.p.un || decoded.p.username,
                  playerId: decoded.p.pi ?? decoded.p.player_id ?? decoded.p.id,
                });
              } else if (decoded.p.ep && decoded.p.ec === 28) {
                resolve({ success: false, error: 'Auth expired (code 28)' });
              } else {
                // Mostrar qué propiedades tiene la respuesta
                const props = Object.keys(decoded.p).join(', ');
                this.logger.error(`❌ Auth failed - no token. Properties: ${props}`);
                resolve({ success: false, error: `Auth failed - no token received. Props: ${props}` });
              }
            }
          } catch (error: any) {
            this.logger.error(`Error processing test message: ${error.message}`);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve({ success: false, error: error.message });
          }
        });

        ws.on('close', () => {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve({ success: false, error: 'Connection closed unexpectedly' });
          }
        });
      } catch (error: any) {
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * Conecta una sesión de apuestas al WebSocket del bookmaker
   */
  async connect(session: UserBettingSession, authMessage: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Obtener configuración del bookmaker
        const config = await this.aviatorWsRepo.findOne({
          where: { bookmakerId: session.bookmakerId, gameId: 1 },
        });

        if (!config) {
          throw new Error('Bookmaker no configurado para Aviator');
        }

        const wsUrl = config.url_websocket;
        const apiMessage = config.api_message;
        const pingMessage = config.ping_message;

        const headers = {
          Pragma: 'no-cache',
          'Cache-Control': 'no-cache',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Origin: session.bookmaker?.bookmakerUrl || 'https://aviator-next.spribegaming.com',
        };

        const ws = new WebSocket(wsUrl, [], { headers });

        const connection: ActiveConnection = {
          sessionId: session.id,
          ws,
          status: 'CONNECTING',
          balance: 0,
          lastPing: new Date(),
          bookmakerId: session.bookmakerId,
          userId: session.userId,
        };

        ws.on('open', () => {
          this.logger.log(`✅ Session ${session.id} connected to bookmaker ${session.bookmakerId}`);
          connection.status = 'CONNECTED';
          // Enviar API message
          ws.send(Buffer.from(apiMessage, 'base64'));
        });

        ws.on('message', (data: Buffer) => {
          this.handleMessage(session.id, data, authMessage);
        });

        ws.on('error', (error) => {
          this.logger.error(`❌ Session ${session.id} WebSocket error: ${error.message}`);
          connection.status = 'DISCONNECTED';
        });

        ws.on('close', () => {
          this.logger.log(`🔴 Session ${session.id} disconnected`);
          connection.status = 'DISCONNECTED';
        });

        this.connections.set(session.id, connection);

        // Configurar ping
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN && pingMessage) {
            ws.send(Buffer.from(pingMessage, 'base64'));
            connection.lastPing = new Date();
          }
        }, 10000);

        // Guardar interval para limpiar después
        (connection as any).pingInterval = pingInterval;

        resolve();
      } catch (error: any) {
        reject(error);
      }
    });
  }

  /**
   * Maneja los mensajes recibidos del WebSocket
   */
  private handleMessage(sessionId: string, data: Buffer, authMessage: string): void {
    try {
      const decoded = decodeMessage(data);
      if (!decoded) return;

      const connection = this.connections.get(sessionId);
      if (!connection) return;

      // Enviar auth después del handshake
      if (decoded.a === 0 && decoded.c === 0) {
        connection.ws.send(Buffer.from(authMessage, 'base64'));
        this.logger.log(`📤 Auth sent for session ${sessionId}`);
      }

      // Guardar tokens de auth
      if (decoded.a === 1 && decoded.c === 0 && decoded.p) {
        if (decoded.p.token) connection.authToken = decoded.p.token;
        if (decoded.p.sessionToken) connection.sessionToken = decoded.p.sessionToken;
        this.logger.log(`🔑 Tokens saved for session ${sessionId}`);
      }

      // Procesar mensajes del juego
      if (decoded.p && decoded.p.c) {
        this.processGameMessage(sessionId, decoded);
      }

      // Actualizar balance
      if (decoded.p?.c === 'newBalance' && decoded.p?.p?.newBalance) {
        connection.balance = decoded.p.p.newBalance;
        this.logger.log(`💰 Balance updated for session ${sessionId}: ${connection.balance}`);
      }

    } catch (error: any) {
      this.logger.error(`Error handling message for session ${sessionId}: ${error.message}`);
    }
  }

  /**
   * Procesa mensajes del juego (apuestas, multiplicadores, crashes)
   */
  private processGameMessage(sessionId: string, decoded: any): void {
    const { p, c } = decoded.p;
    const connection = this.connections.get(sessionId);
    if (!connection) return;

    // Aquí se procesarían los eventos del juego
    // Por ahora solo logeamos
    if (c === 'x') {
      this.logger.log(`📊 Multiplier update for session ${sessionId}: ${p.x}x`);
    }
  }

  /**
   * Envía una apuesta al servidor
   */
  async sendBet(sessionId: string, betMessageBase64: string): Promise<void> {
    const connection = this.connections.get(sessionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Session not connected');
    }

    connection.ws.send(Buffer.from(betMessageBase64, 'base64'));
    connection.status = 'BETTING';
    this.logger.log(`📤 Bet sent for session ${sessionId}`);
  }

  /**
   * Envía un cashout manual
   */
  async sendCashout(sessionId: string, betId: 1 | 2): Promise<void> {
    const connection = this.connections.get(sessionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Session not connected');
    }

    // Crear mensaje de cashout
    const cashoutMsg = {
      c: 1,
      a: 13,
      p: {
        c: 'betHandler',
        r: -1,
        p: {
          action: 'cashout',
          betId,
        },
      },
    };

    // TODO: Codificar el mensaje con el encoder
    // Por ahora esto es un placeholder
    this.logger.log(`📤 Cashout sent for session ${sessionId}, betId ${betId}`);
  }

  /**
   * Desconecta una sesión
   */
  async disconnect(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId);
    if (!connection) return;

    if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.close(1000, 'Session stopped');
    }

    // Limpiar ping interval
    if ((connection as any).pingInterval) {
      clearInterval((connection as any).pingInterval);
    }

    this.connections.delete(sessionId);
    this.logger.log(`🔴 Session ${sessionId} disconnected`);
  }

  /**
   * Obtiene el estado de una conexión
   */
  getConnectionStatus(sessionId: string): ActiveConnection | undefined {
    return this.connections.get(sessionId);
  }

  /**
   * Obtiene todas las conexiones activas
   */
  getActiveConnections(): ActiveConnection[] {
    return Array.from(this.connections.values()).filter(c => c.status !== 'DISCONNECTED');
  }

  /**
   * Solicita el historial de apuestas del usuario al bookmaker
   * Se llama automáticamente cada ronda en modo automático
   */
  async requestBetHistory(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(`Cannot request history: Session ${sessionId} not connected`);
      return;
    }

    const historyMessage = createHistoryRequestMessage();
    connection.ws.send(Buffer.from(historyMessage, 'base64'));
    connection.lastHistoryRequest = new Date();
    this.logger.log(`📜 History requested for session ${sessionId}`);
  }

  /**
   * Registra un callback para cuando llegue el historial
   */
  onHistoryReceived(sessionId: string, callback: HistoryCallback): void {
    if (!this.historyCallbacks.has(sessionId)) {
      this.historyCallbacks.set(sessionId, []);
    }
    this.historyCallbacks.get(sessionId)!.push(callback);
  }

  /**
   * Procesa la respuesta del historial de apuestas
   */
  private processHistoryResponse(sessionId: string, historyData: any): void {
    this.logger.log(`📜 History received for session ${sessionId}`);

    // Notificar a los callbacks registrados
    const callbacks = this.historyCallbacks.get(sessionId);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(sessionId, historyData);
        } catch (err: any) {
          this.logger.error(`Error in history callback: ${err.message}`);
        }
      }
    }

    // Emitir evento global para que otros servicios lo procesen
    const connection = this.connections.get(sessionId);
    if (connection) {
      // El evento será capturado por el servicio de integración
      if ((global as any).bettingHistoryReceived) {
        (global as any).bettingHistoryReceived(sessionId, connection.userId, connection.bookmakerId, historyData);
      }
    }
  }

  /**
   * Solicita historial para todas las sesiones activas
   * Se llama automáticamente cuando termina una ronda
   */
  async requestHistoryForAllActiveSessions(): Promise<void> {
    const activeSessions = this.getActiveConnections();
    
    for (const conn of activeSessions) {
      if (conn.status === 'CONNECTED' || conn.status === 'WAITING') {
        await this.requestBetHistory(conn.sessionId);
      }
    }
  }
}
