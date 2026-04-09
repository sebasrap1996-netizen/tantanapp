import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { WebSocket } from 'ws';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AviatorWs } from '../../entities/aviator-ws.entity';
import { Bookmaker } from '../../entities/bookmaker.entity';
import { AviatorGateway } from '../../gateways/aviator.gateway';
import { AviatorLoggerWrapper } from '../../config/winston.config';
import { decodeMessage } from './decoder';
import { StrategiesService } from '../../services/strategies/strategies.service';
import { createApiMessage, createPingMessage } from './encoder';

interface Connection {
  ws: WebSocket | null;
  status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';
  lastPing: Date | null;
}

interface RoundData {
  betsCount: number;
  totalBetAmount: number;
  onlinePlayers: number;
  roundId: string | null;
  maxMultiplier: number;
  currentMultiplier: number;
  totalCashout: number;
  cashoutRecords: Set<string>;
  gameState: 'Bet' | 'Run' | 'End';
}

interface BookmakerWithConfig extends Bookmaker {
  url_websocket: string;
  api_message: string;
  auth_message: string;
  ping_message: string;
  nombre?: string; // Campo opcional para compatibilidad
  // Campos para tokens dinámicos
  use_dynamic_tokens?: boolean;
  api_token?: string | null;
  session_token?: string | null;
  player_id?: string | null;
  game_zone?: string | null;
}

@Injectable()
export class AviatorWebSocketService {
  private readonly logger = new AviatorLoggerWrapper();
  private connections: Map<number, Connection> = new Map();
  private roundData: Map<number, RoundData> = new Map();
  private pingIntervals: Map<number, NodeJS.Timeout> = new Map();
  private maxRetries: number = 10; // Aumentar intentos de reconexión
  private retryDelay: number = 3000; // Reducir delay inicial
  private io: any = null;
  private isResetting: boolean = false;
  private connectingBookmakers: Set<number> = new Set(); // Prevenir conexiones múltiples simultáneas
  private lastResults: string = ''; // Cache para reducir logs
  private verificationInterval: NodeJS.Timeout | null = null; // Controlar el intervalo de verificación
  private isInitialized: boolean = false; // Evitar múltiples inicializaciones

  constructor(
    @InjectRepository(AviatorWs)
    private aviatorWsRepository: Repository<AviatorWs>,
    @InjectRepository(Bookmaker)
    private bookmakerRepository: Repository<Bookmaker>,
    private gateway: AviatorGateway,
    @Inject(forwardRef(() => StrategiesService))
    private strategiesService: StrategiesService,
  ) {}

  async initializeConnections(io: any): Promise<void> {
    console.log('🔌 [AVIATOR-SERVICE] >>> initializeConnections LLAMADO <<<');
    
    // Evitar múltiples inicializaciones completas
    if (this.isInitialized) {
      console.log('⚠️ [AVIATOR-SERVICE] Servicio ya inicializado, omitiendo');
      return;
    }
    
    // Verificar si ya hay conexiones activas para evitar reinicios innecesarios
    const activeConnections = Array.from(this.connections.values()).filter(
      conn => conn.status === 'CONNECTED' || conn.status === 'CONNECTING'
    );
    
    if (activeConnections.length > 0) {
      console.log(`⚠️ [AVIATOR-SERVICE] Ya hay ${activeConnections.length} conexiones activas, omitiendo inicialización`);
      return;
    }
    
    // Limpiar intervalo existente si hay
    if (this.verificationInterval) {
      clearInterval(this.verificationInterval);
      this.verificationInterval = null;
    }
    
    this.io = this.gateway.getServer(); // USAR EL GATEWAY DIRECTAMENTE
    
    console.log('🔌 [AVIATOR-SERVICE] Gateway.getServer() =', this.io ? 'OK' : 'NULL');
    
    if (!this.io) {
      this.logger.error('❌ ERROR: Gateway server es null. Esperando 2 segundos...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.io = this.gateway.getServer();
      
      if (!this.io) {
        this.logger.error('❌ ERROR CRÍTICO: No se pudo obtener el servidor del gateway');
        throw new Error('Gateway server no disponible');
      }
    }
    
    this.logger.log('✅ Inicializando conexiones WebSocket de Aviator');
    console.log('🔄 [AVIATOR-SERVICE] Obteniendo bookmakers...');
    
    try {
      const bookmakers = await this.getBookmakersWithConfigs();
      console.log(`📊 [AVIATOR-SERVICE] Bookmakers encontrados: ${bookmakers.length}`);
      
      for (const bookmaker of bookmakers) {
        console.log(`🔍 [AVIATOR-SERVICE] Procesando bookmaker ${bookmaker.id} (${bookmaker.bookmaker})`);
        console.log(`   - URL WebSocket: ${bookmaker.url_websocket || 'NO CONFIGURADO'}`);
        
        if (this.isValidBookmaker(bookmaker, 'initializeConnections')) {
          console.log(`✅ [AVIATOR-SERVICE] Bookmaker ${bookmaker.id} válido, conectando...`);
          this.connectToBookmaker(bookmaker, this.io, 0);
        } else {
          console.log(`❌ [AVIATOR-SERVICE] Bookmaker ${bookmaker.id} inválido, omitiendo`);
          this.logger.warn(`Configuración inválida para bookmaker ${bookmaker.id}, omitiendo conexión`);
        }
      }

      // Verificar actualizaciones de bookmakers cada minuto
      this.verificationInterval = setInterval(async () => {
        if (this.isResetting) return;
        try {
          const updatedBookmakers = await this.getBookmakersWithConfigs();
          console.log(`🔍 [VERIFICATION] Verificando ${updatedBookmakers.length} bookmakers. Conexiones activas: ${this.connections.size}`);
          updatedBookmakers.forEach((bookmaker) => {
            const hasConnection = this.connections.has(bookmaker.id);
            const connection = hasConnection ? this.connections.get(bookmaker.id) : null;
            console.log(`   - Bookmaker ${bookmaker.id}: hasConnection=${hasConnection}, status=${connection?.status || 'N/A'}, wsState=${connection?.ws?.readyState}`);
            
            if (
              this.isValidBookmaker(bookmaker, 'verificationInterval') &&
              !this.connections.has(bookmaker.id)
            ) {
              console.log(`🔄 [VERIFICATION] Reconectando bookmaker ${bookmaker.id} - no hay conexión en map`);
              this.connectToBookmaker(bookmaker, io, 0);
            } else if (
              (!this.isValidBookmaker(bookmaker, 'verificationInterval-close') && this.connections.has(bookmaker.id))
            ) {
              const connection = this.connections.get(bookmaker.id);
              if (connection?.ws) {
                connection.ws.close();
                this.logger.log(`Closed WebSocket for bookmaker ${bookmaker.id} due to invalid config`);
              }
              clearInterval(this.pingIntervals.get(bookmaker.id));
              this.connections.delete(bookmaker.id);
              this.pingIntervals.delete(bookmaker.id);
              this.roundData.delete(bookmaker.id);
            }
          });
        } catch (error) {
          this.logger.error('Error checking bookmakers for WebSocket updates:', error);
        }
      }, 60000);
      
      // Marcar como inicializado
      this.isInitialized = true;
      console.log('✅ [AVIATOR-SERVICE] Servicio inicializado correctamente');
    } catch (error) {
      this.logger.error('Error initializing WebSocket connections:', error);
    }
  }

  private isValidBookmaker(bookmaker: BookmakerWithConfig, source: string = 'unknown'): boolean {
    const { url_websocket } = bookmaker;
    
    // SOLO validar WebSocket seguro (wss://) - Protocolo nuevo (JSON + base64)
    // El protocolo ws:// (GoBet) se maneja en gobet-websocket.service.ts
    if (url_websocket && url_websocket.startsWith('wss://')) {
      console.log(`✅ [VALIDATION-WSS] Bookmaker ${bookmaker.id} usa wss:// (source: ${source})`);
      return true;
    }
    
    console.log(`❌ [VALIDATION-WSS] Bookmaker ${bookmaker.id} NO usa wss://, omitiendo (URL: ${url_websocket}, source: ${source})`);
    return false;
  }

  private async getBookmakersWithConfigs(): Promise<BookmakerWithConfig[]> {
    const bookmakers = await this.bookmakerRepository.find({
      where: { 
        isActive: true,
        gameId: 1 // Aviator game ID
      }
    });

    // Usar los campos del bookmaker configurados manualmente por el administrador
    return bookmakers
      .filter(bm => bm.urlWebsocket && bm.urlWebsocket.startsWith('wss://'))
      .map(bm => {
        return {
          ...bm,
          url_websocket: bm.urlWebsocket,
          api_message: bm.apiMessage || '',
          auth_message: bm.authMessage || '',
          ping_message: bm.pingMessage || '',
        } as BookmakerWithConfig;
      });
  }

  private buildAuthMessageWithToken(sessionToken: string, originalAuthMessage: string): string {
    try {
      // Decodificar el auth_message original para ver su estructura
      const decodedOriginal = Buffer.from(originalAuthMessage, 'base64');
      const decodedObj = decodeMessage(decodedOriginal);
      
      console.log(`🔍 [AUTH] Auth message original:`, decodedObj);
      
      // Reemplazar el sessionToken con el token del handshake
      if (decodedObj && decodedObj.p && decodedObj.p.p && decodedObj.p.p.sessionToken) {
        decodedObj.p.p.sessionToken = sessionToken;
        console.log(`🔧 [AUTH] sessionToken actualizado: ${sessionToken}`);
        
        // También actualizar el token principal si existe
        if (decodedObj.p.p.token) {
          decodedObj.p.p.token = sessionToken;
          console.log(`🔧 [AUTH] token actualizado: ${sessionToken}`);
        }
        
        // Recodificar el mensaje a binario y luego a base64
        // Por ahora, necesitamos crear un nuevo mensaje manualmente
        const newAuthMessage = this.createAuthMessage(sessionToken);
        console.log(`🔧 [AUTH] Nuevo auth_message creado con token del handshake`);
        return newAuthMessage;
      }
      
      return originalAuthMessage;
      
    } catch (error) {
      console.error(`❌ [AUTH] Error construyendo auth_message con token:`, error);
      return originalAuthMessage;
    }
  }

  private createAuthMessage(sessionToken: string): string {
    // Crear un auth_message simple con el token del handshake
    const authObj = {
      c: 0,
      a: 1,
      p: {
        zn: 'aviator_core_inst7',
        un: '753098107&&1xslot',
        pw: '',
        p: {
          token: sessionToken,
          sessionToken: sessionToken,
          currency: 'COP',
          lang: 'es',
          platform: { id: 1 },
          version: 'v4.2.106-hotfix'
        }
      }
    };
    
    // Convertir a string y luego a base64 (simplificado)
    // NOTA: Esto debería ser codificado binariamente, pero es una solución temporal
    const authString = JSON.stringify(authObj);
    return Buffer.from(authString).toString('base64');
  }

  private connectToBookmaker(bookmaker: BookmakerWithConfig, io: any, retryCount: number): void {
    const { id, bookmaker: name, url_websocket, api_message, auth_message, ping_message } = bookmaker;
    
    // LOG: Mostrar qué auth_message está usando
    this.logger.log(`🔑 [DEBUG] Bookmaker ${id} - auth_message: ${auth_message ? auth_message.substring(0, 50) + '...' : 'NULL'}`);
    
    // Prevenir conexiones múltiples simultáneas para el mismo bookmaker
    if (this.connectingBookmakers.has(id)) {
      this.logger.log(`Ya se está conectando al bookmaker ${id}, saltando conexión duplicada`);
      return;
    }

    // Verificar si ya hay una conexión activa
    const existingConnection = this.connections.get(id);
    if (existingConnection && existingConnection.status === 'CONNECTED' && existingConnection.ws?.readyState === WebSocket.OPEN) {
      this.logger.log(`WebSocket ya está conectado para bookmaker ${id}, saltando conexión`);
      return;
    }

    this.connectingBookmakers.add(id);

    const headers = {
      Pragma: 'no-cache',
      'Cache-Control': 'no-cache',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Origin: 'https://aviator-next.spribegaming.com',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'es-419,es;q=0.9',
      'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
    };

    try {
      if (!this.isValidBookmaker(bookmaker, 'connectToBookmaker')) {
        throw new Error(`Invalid configuration for bookmaker ${id}`);
      }

      // Limpiar conexión existente
      if (this.connections.has(id)) {
        const connection = this.connections.get(id);
        if (connection?.ws) {
          connection.ws.close(1000, 'Closing for reset');
          this.logger.log(`Closed existing WebSocket for bookmaker ${id}`);
        }
        clearInterval(this.pingIntervals.get(id));
        this.connections.delete(id);
        this.pingIntervals.delete(id);
        this.roundData.delete(id);
      }

      console.log(`🔗 [CONNECT] Conectando a URL: ${url_websocket}`);
      const ws = new WebSocket(url_websocket, [], { headers });

      this.connections.set(id, { ws, status: 'CONNECTING', lastPing: null });
      this.updateWebSocketStatusInDB(id, 'CONNECTING'); // Actualizar estado en BD
      this.roundData.set(id, {
        betsCount: 0,
        totalBetAmount: 0,
        onlinePlayers: 0,
        roundId: null,
        maxMultiplier: 0,
        currentMultiplier: 0,
        totalCashout: 0,
        cashoutRecords: new Set(),
        gameState: 'Bet',
      });

      // TODOS los bookmakers usan protocolo binario (base64)
      // No importa si es ws:// o wss://
      const isLegacyProtocol = true;
      console.log(`📡 [CONNECT] Bookmaker ${id} usa protocolo BINARIO (base64)`);

      ws.on('open', () => {
        this.logger.log(`WebSocket connected for bookmaker ${id}`);
        this.connections.set(id, { ws, status: 'CONNECTED', lastPing: new Date() });
        this.connectingBookmakers.delete(id); // Remover del set de conexiones en progreso
        this.updateWebSocketStatusInDB(id, 'CONNECTED'); // Actualizar estado en BD
        
        // Usar api_message de BD o generar uno nuevo
        const apiMsg = api_message || createApiMessage();
        console.log(`📤 [BINARY] Enviando api_message en base64 para bookmaker ${id}`);
        console.log(`   API Message: ${apiMsg.substring(0, 50)}...`);
        ws.send(Buffer.from(apiMsg, 'base64'));
      });

      ws.on('message', async (data: Buffer) => {
        try {
          let obj: any;
          
          if (isLegacyProtocol) {
            const decodedMessage = decodeMessage(data);
            if (!decodedMessage) {
              return;
            }
            
            this.connections.set(id, { ws, status: 'CONNECTED', lastPing: new Date() });

            // ENVIAR auth_message DESPUÉS del primer mensaje (handshake)
            if (!(ws as any).firstResponseReceived) {
              console.log(`📤 [LEGACY] Enviando auth_message en base64 para bookmaker ${id}`);
              ws.send(Buffer.from(auth_message, 'base64'));
              (ws as any).firstResponseReceived = true;
            }

            // GUARDAR TOKENS de la respuesta de autenticación
            if (decodedMessage.a === 1 && decodedMessage.c === 0 && decodedMessage.p) {
              if (decodedMessage.p.token || decodedMessage.p.sessionToken) {
                (ws as any).authToken = decodedMessage.p.token;
                (ws as any).sessionToken = decodedMessage.p.sessionToken;
                console.log(`🔑 [TOKEN] Tokens guardados para bookmaker ${id}`);
                console.log(`✅ [AUTH] Autenticación EXITOSA para bookmaker ${id}`);
              } else if (decodedMessage.p.ep && decodedMessage.p.ec === 28) {
                console.error(`❌ [AUTH] Autenticación FALLIDA para bookmaker ${id} - Error code 28`);
              }
            }

            obj = decodedMessage;
          } else {
            // Protocolo nuevo: parsear JSON
            const text = data.toString('utf8');
            obj = JSON.parse(text);
            console.log(`📥 [JSON] Mensaje JSON recibido para bookmaker ${id}`);
          }
          
          // EMITIR RAW INMEDIATAMENTE para ambos protocolos
          const server = this.gateway.getServer();
          if (server) {
            // Emitir SOLO a la sala específica del bookmaker
            server.to(`bookmaker:${id}`).emit('aviator_raw', { bookmakerId: id, data: obj, protocol: isLegacyProtocol ? 'legacy' : 'json' });
            
            // Log cada 100 mensajes para verificar
            if (Math.random() < 0.01) {
              this.logger.log(`📡 Emitiendo aviator_raw para bookmaker ${id} (${isLegacyProtocol ? 'legacy' : 'json'})`);
            }
          } else {
            this.logger.error(`>>> ERROR: Gateway server es null, no se puede emitir aviator_raw`);
          }
          
          this.connections.set(id, { ws, status: 'CONNECTED', lastPing: new Date() });

          const roundData = this.roundData.get(id);
          if (!roundData) return;
          
          // Normalizar estructura según protocolo
          let gameMessage: any;
          
          if (isLegacyProtocol) {
            // Protocolo legacy: estructura obj.p.p
            if (!obj.p || !obj.p.p) return;
            gameMessage = obj.p;
          } else {
            // Protocolo JSON: estructura obj.p (canal 13)
            if (obj.a !== 13 || obj.c !== 1 || !obj.p) return;
            gameMessage = { p: obj.p, c: obj.p.c };
          }
          
          const decodedMessage = gameMessage;
          
          // obj.p ya tiene {c: comando, p: payload} directamente
          const { p, c } = decodedMessage;
          if (p && c) {
            
            if (c === 'updateCurrentBets') {
              // Solo actualizar durante estado Bet (o si aún no hay estado definido)
              if (roundData.gameState === 'Bet' || !roundData.gameState) {
                roundData.betsCount = p.betsCount || 0;
                roundData.totalBetAmount = p.bets?.reduce((sum: number, bet: any) => sum + (bet.bet || 0), 0) || 0;
                
                // Contar jugadores únicos
                const uniquePlayers = new Set(p.bets?.map((bet: any) => bet.player_id) || []);
                roundData.onlinePlayers = uniquePlayers.size || p.activePlayersCount || 0;
                
                this.logger.log(`💰 Apuestas actualizadas - Round: ${roundData.roundId}, Apuestas: ${roundData.betsCount}, Total: $${roundData.totalBetAmount}, Jugadores: ${roundData.onlinePlayers}`);
              }
            } else if (c === 'changeState') {
              if (p.state === 1) {
                roundData.gameState = 'Bet';
                roundData.roundId = p.roundId || roundData.roundId;
                roundData.currentMultiplier = 0;
                if (p.roundId && this.io) {
                  this.io.to(`bookmaker:${id}`).emit('roundStart', {
                    roundId: p.roundId,
                    gameState: 'Bet',
                  });
                }
              } else if (p.state === 2) {
                roundData.gameState = 'Run';
                roundData.roundId = p.roundId || roundData.roundId;
              }
            } else if (c === 'updateCurrentCashOuts') {
              // Usar el total que ya viene calculado
              if (p.totalCashOut !== undefined) {
                roundData.totalCashout = p.totalCashOut;
              }
            } else if (c === 'x') {
              this.logger.log(`🔍 [DEBUG] Evento 'x' recibido para bookmaker ${id}. Payload:`, JSON.stringify(p));
              if (p.crashX !== undefined) {
                this.logger.log(`🎯 CRASH detectado para bookmaker ${id}: ${p.crashX}x - Round: ${roundData.roundId}`);
                this.logger.log(`📊 Datos de la ronda: Apuestas=${roundData.betsCount}, Total=${roundData.totalBetAmount}, Jugadores=${roundData.onlinePlayers}, Cashout=${roundData.totalCashout}`);
                
                roundData.maxMultiplier = p.crashX || 0;
                roundData.currentMultiplier = p.crashX || 0;
                roundData.gameState = 'End';
                
                // Esperar 500ms para asegurarnos de que el roundId haya llegado
                setTimeout(async () => {
                  if (roundData.roundId) {
                    await this.saveRoundData(id, name, p.crashX);
                    
                    // Emitir historial actualizado al frontend
                    if (this.io) {
                      this.logger.log(`🔄 Obteniendo historial actualizado para bookmaker ${id}...`);
                      const updatedHistory = await this.fetchRecentRounds(id, 100);
                      this.logger.log(`📊 Historial obtenido: ${updatedHistory.length} rondas`);
                      this.logger.log(`🎯 Primera ronda: ${updatedHistory[0]?.round_id} - ${updatedHistory[0]?.max_multiplier}x`);
                      this.logger.log(`📡 Emitiendo al room: bookmaker:${id}`);
                      this.io.to(`bookmaker:${id}`).emit('history', {
                        bookmakerId: id,
                        rounds: updatedHistory
                      });
                      this.logger.log(`✅ Historial actualizado emitido para bookmaker ${id} - ${updatedHistory.length} rondas`);
                    } else {
                      this.logger.error(`❌ ERROR: this.io es NULL, no se puede emitir historial para bookmaker ${id}`);
                    }
                    
                    setTimeout(() => this.resetRoundData(id), 4000);
                  } else {
                    this.logger.warn(`⚠️ No hay roundId después de esperar para guardar el crash ${p.crashX}x`);
                  }
                }, 500);
              } else {
                roundData.currentMultiplier = p.x || 0;
                roundData.gameState = 'Run';
                if (this.io) {
                  const multiplierData = {
                    bookmakerId: id,
                    current_multiplier: roundData.currentMultiplier.toFixed(2),
                  };
                  // this.logger.log(`Emitiendo multiplicador para bookmaker ${id}: ${JSON.stringify(multiplierData)}`);
                  this.io.to(`bookmaker:${id}`).emit('multiplier', multiplierData);
                }
              }
            } else if (c === 'roundChartInfo') {
              if (p.roundId) {
                roundData.roundId = p.roundId;
                roundData.maxMultiplier = p.maxMultiplier || 0;
                roundData.currentMultiplier = p.maxMultiplier || 0;
                roundData.gameState = 'End';
                
                if (this.io) {
                  this.io.to(`bookmaker:${id}`).emit('roundChartInfo', {
                    maxMultiplier: p.maxMultiplier,
                    roundId: p.roundId,
                  });
                }
                
                // Guardar datos y emitir historial actualizado
                setTimeout(async () => {
                  if (roundData.roundId && roundData.maxMultiplier > 0) {
                    await this.saveRoundData(id, name, roundData.maxMultiplier);
                    
                    // Emitir historial actualizado al frontend
                    if (this.io) {
                      this.logger.log(`🔄 [roundChartInfo] Obteniendo historial actualizado para bookmaker ${id}...`);
                      const updatedHistory = await this.fetchRecentRounds(id, 100);
                      this.io.to(`bookmaker:${id}`).emit('history', {
                        bookmakerId: id,
                        rounds: updatedHistory
                      });
                      this.logger.log(`✅ [roundChartInfo] Historial actualizado emitido para bookmaker ${id} - ${updatedHistory.length} rondas`);
                    }
                    
                    setTimeout(() => this.resetRoundData(id), 4000);
                  }
                }, 500);
              }
            }

            const casinoProfit = roundData.totalBetAmount - roundData.totalCashout;
            if (this.io) {
              const roundDataToEmit = {
                online_players: roundData.onlinePlayers,
                bets_count: roundData.betsCount,
                total_bet_amount: roundData.totalBetAmount,
                total_cashout: roundData.totalCashout,
                current_multiplier: roundData.currentMultiplier,
                max_multiplier: roundData.maxMultiplier,
                game_state: roundData.gameState,
                casino_profit: Number(casinoProfit.toFixed(2)),
                round_id: roundData.roundId,
              };
              // this.logger.log(`Emitiendo datos de ronda para bookmaker ${id}: ${JSON.stringify(roundDataToEmit)}`);
              this.io.to(`bookmaker:${id}`).emit('round', roundDataToEmit);
            }
          }
        } catch (error) {
          this.logger.error(`Error processing message for bookmaker ${id}:`, error);
        }
      });

      ws.on('error', (error: Error) => {
        this.logger.error(`WebSocket error for bookmaker ${id}: ${error.message}`);
        
        // Solo actualizar estado si realmente está desconectado
        if (ws.readyState === WebSocket.CLOSED) {
          this.connections.set(id, { ws, status: 'DISCONNECTED', lastPing: this.connections.get(id)?.lastPing || null });
          this.updateWebSocketStatusInDB(id, 'DISCONNECTED'); // Actualizar estado en BD
          
          // Solo reconectar si no estamos reseteando
          if (!this.isResetting) {
            this.handleReconnect(bookmaker, io, retryCount);
          }
        } else {
          // Si el WebSocket sigue abierto, solo loggear el error pero no cambiar estado
          this.logger.warn(`WebSocket error pero conexión sigue activa para bookmaker ${id}: ${error.message}`);
        }
      });

      ws.on('close', async (code: number, reason: Buffer) => {
        this.logger.log(`WebSocket closed for bookmaker ${id} (code: ${code}, reason: ${reason || 'No reason provided'})`);
        this.connections.set(id, { ws, status: 'DISCONNECTED', lastPing: this.connections.get(id)?.lastPing || null });
        this.updateWebSocketStatusInDB(id, 'DISCONNECTED'); // Actualizar estado en BD
        this.connectingBookmakers.delete(id); // Remover del set de conexiones en progreso
        
        // Limpiar interval de PING
        clearInterval(this.pingIntervals.get(id));
        this.pingIntervals.delete(id);
        
        // Guardar datos de la ronda si es necesario
        const roundData = this.roundData.get(id);
        if (roundData?.roundId && roundData.maxMultiplier > 0) {
          await this.saveRoundData(id, name, roundData.maxMultiplier);
        }
        
        // Solo reconectar si no estamos reseteando
        if (!this.isResetting) {
          this.handleReconnect(bookmaker, io, retryCount);
        }
      });

      // Configurar ping según protocolo
      // Solo enviar PING cuando el WebSocket está OPEN
      // Las reconexiones se manejan exclusivamente en los eventos 'close' y 'error'
      const pingMsg = ping_message || createPingMessage();
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          if (isLegacyProtocol) {
            // Protocolo legacy: enviar ping_message en base64
            ws.send(Buffer.from(pingMsg, 'base64'));
            console.log(`📤 [LEGACY-PING] Enviando ping para bookmaker ${id}`);
          }
          // Protocolo JSON no requiere ping manual
          
          this.connections.set(id, { 
            ws, 
            status: 'CONNECTED', 
            lastPing: new Date() 
          });
        }
        // NOTA: No llamar a handleReconnect aquí. El evento 'close' maneja las reconexiones.
      }, 10000);

      this.pingIntervals.set(id, pingInterval);
    } catch (error) {
      this.logger.error(`Failed to connect WebSocket for bookmaker ${id}:`, error);
      this.connections.set(id, { ws: null, status: 'DISCONNECTED', lastPing: null });
      this.updateWebSocketStatusInDB(id, 'DISCONNECTED'); // Actualizar estado en BD
      this.connectingBookmakers.delete(id); // Remover del set de conexiones en progreso
      if (!this.isResetting) {
        this.handleReconnect(bookmaker, io, retryCount);
      }
    }
  }

  private handleReconnect(bookmaker: BookmakerWithConfig, io: any, retryCount: number): void {
    // Verificar si ya hay una conexión activa antes de reconectar
    const existingConnection = this.connections.get(bookmaker.id);
    if (existingConnection && existingConnection.status === 'CONNECTED' && existingConnection.ws?.readyState === WebSocket.OPEN) {
      this.logger.log(`WebSocket ya está conectado para bookmaker ${bookmaker.id}, saltando reconexión`);
      return;
    }

    // Actualizar estado a CONNECTING cuando se inicia reconexión
    this.updateWebSocketStatusInDB(bookmaker.id, 'CONNECTING');

    if (retryCount >= this.maxRetries) {
      this.logger.error(`ACTUALIZA TU TOKEN para bookmaker ${bookmaker.id}. Máximo de intentos (${this.maxRetries}) alcanzado.`);
      // En lugar de parar completamente, intentar reconectar después de 5 minutos
      setTimeout(() => {
        this.logger.log(`Reintentando conexión para bookmaker ${bookmaker.id} después de timeout`);
        this.connectToBookmaker(bookmaker, io, 0);
      }, 300000); // 5 minutos
      return;
    }

    // Backoff exponencial con jitter
    const delay = Math.min(this.retryDelay * Math.pow(2, retryCount), 60000) + Math.random() * 1000;
    this.logger.log(`Attempting to reconnect for bookmaker ${bookmaker.id} (Attempt ${retryCount + 1}/${this.maxRetries}) in ${Math.round(delay)}ms`);
    
    setTimeout(() => {
      this.connectToBookmaker(bookmaker, io, retryCount + 1);
    }, delay);
  }

  private async updateWebSocketStatusInDB(bookmakerId: number, status: string): Promise<void> {
    try {
      // Usar save() en lugar de update() para que se ejecute el trigger de updated_at
      const aviatorWs = await this.aviatorWsRepository.findOne({ where: { bookmakerId } });
      if (aviatorWs) {
        aviatorWs.status_ws = status;
        await this.aviatorWsRepository.save(aviatorWs);
        this.logger.log(`Estado WebSocket actualizado en BD para bookmaker ${bookmakerId}: ${status}`);
      }
    } catch (error) {
      this.logger.error(`Error actualizando estado WebSocket en BD para bookmaker ${bookmakerId}:`, error);
    }
  }

  private async saveRoundData(bookmaker_id: number, bookmaker_name: string, crashX: number): Promise<void> {
    const roundData = this.roundData.get(bookmaker_id);
    if (!roundData) return;

    try {
      this.logger.log(`Saving round data for ${bookmaker_name}: Crash at ${crashX}x`);
      
      // Calcular datos adicionales
      const casinoProfit = roundData.totalBetAmount - roundData.totalCashout;
      const lossPercentage = roundData.totalBetAmount > 0 ? 
        ((casinoProfit / roundData.totalBetAmount) * 100) : 0;

      // Insertar en la tabla aviator_rounds con deduplicación
      await this.aviatorWsRepository.query(`
        INSERT INTO aviator_rounds (
          bookmaker_id, 
          round_id, 
          bets_count, 
          total_bet_amount, 
          online_players, 
          max_multiplier, 
          total_cashout, 
          casino_profit, 
          loss_percentage, 
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (bookmaker_id, round_id) DO NOTHING
      `, [
        bookmaker_id,
        roundData.roundId,
        roundData.betsCount,
        roundData.totalBetAmount,
        roundData.onlinePlayers,
        crashX,
        roundData.totalCashout,
        casinoProfit,
        lossPercentage,
        new Date()
      ]);

      this.logger.log(`✅ Round data saved successfully for ${bookmaker_name} - Round ${roundData.roundId}`);

      // 🔥 ANALIZAR ESTRATEGIAS DESPUÉS DE GUARDAR RONDA
      try {
        const recentRounds = await this.fetchRecentRoundsForStrategies(bookmaker_id, 30);
        if (recentRounds.length > 0) {
          const results = recentRounds.map(r => r.max_multiplier);
          const timestamps = recentRounds.map(r => r.created_at);
          const roundIds = recentRounds.map(r => r.round_id);
          
          await this.strategiesService.analyzeStrategiesWithState(results, timestamps, roundIds, bookmaker_id);
        }
      } catch (strategyError) {
        this.logger.error(`Error analizando estrategias:`, strategyError);
      }
    } catch (error) {
      this.logger.error(`Error saving round data for bookmaker ${bookmaker_id}:`, error);
    }
  }

  private resetRoundData(bookmaker_id: number): void {
    this.roundData.set(bookmaker_id, {
      betsCount: 0,
      totalBetAmount: 0,
      onlinePlayers: 0,
      roundId: null,
      maxMultiplier: 0,
      currentMultiplier: 0,
      totalCashout: 0,
      cashoutRecords: new Set(),
      gameState: 'Bet',
    });
  }

  async resetAllConnections(): Promise<void> {
    try {
      this.isResetting = true;
      this.logger.log('Resetting all WebSocket connections...');

      // Limpiar intervalo de verificación
      if (this.verificationInterval) {
        clearInterval(this.verificationInterval);
        this.verificationInterval = null;
      }

      for (const [bookmakerId, connection] of this.connections) {
        if (connection.ws) {
          connection.ws.close(1000, 'Reset requested');
        }
        clearInterval(this.pingIntervals.get(bookmakerId));
        this.pingIntervals.delete(bookmakerId);
      }

      this.connections.clear();
      this.roundData.clear();
      this.connectingBookmakers.clear(); // Limpiar conexiones en progreso
      
      // Reinicializar bloqueo
      this.isInitialized = false;

      this.logger.log('All connections reset successfully');
      
      // Esperar 5 segundos antes de permitir reconexiones automáticas
      setTimeout(() => {
        this.isResetting = false;
        this.logger.log('Reset completed, reconexiones automáticas habilitadas');
      }, 5000);
      
    } catch (error) {
      this.logger.error('Error resetting connections:', error);
      this.isResetting = false;
    }
  }

  // Para estrategias: más reciente primero (results[0] = más reciente)
  private async fetchRecentRoundsForStrategies(
    bookmakerId: number,
    limit: number = 30,
  ): Promise<Array<{
    round_id: string;
    max_multiplier: number;
    total_bet_amount: number;
    total_cashout: number;
    casino_profit: number;
    bets_count: number;
    online_players: number;
    created_at: string;
  }>> {
    const rows = await this.aviatorWsRepository.query(
      `SELECT DISTINCT ON (round_id) round_id, max_multiplier, total_bet_amount, total_cashout, casino_profit, bets_count, online_players, created_at
       FROM aviator_rounds
       WHERE bookmaker_id = $1
       ORDER BY round_id DESC, created_at DESC
       LIMIT $2`,
      [bookmakerId, limit]
    );

    return rows.map((r: any) => ({
      round_id: r.round_id,
      max_multiplier: Number(r.max_multiplier),
      total_bet_amount: Number(r.total_bet_amount),
      total_cashout: Number(r.total_cashout),
      casino_profit: Number(r.casino_profit),
      bets_count: Number(r.bets_count),
      online_players: Number(r.online_players),
      created_at: new Date(r.created_at).toISOString(),
    }));
    // NO reverse - estrategias esperan results[0] = más reciente
  }

  // Para gráfica: más antiguo primero (izquierda=antiguo, derecha=reciente)
  private async fetchRecentRounds(
    bookmakerId: number,
    limit: number = 30,
  ): Promise<Array<{
    round_id: string;
    max_multiplier: number;
    total_bet_amount: number;
    total_cashout: number;
    casino_profit: number;
    bets_count: number;
    online_players: number;
    created_at: string;
  }>> {
    const rows = await this.aviatorWsRepository.query(
      `SELECT round_id, max_multiplier, total_bet_amount, total_cashout, casino_profit, bets_count, online_players, created_at
       FROM aviator_rounds
       WHERE bookmaker_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [bookmakerId, limit]
    );

    return rows
      .map((r: any) => ({
        round_id: r.round_id,
        max_multiplier: Number(r.max_multiplier),
        total_bet_amount: Number(r.total_bet_amount),
        total_cashout: Number(r.total_cashout),
        casino_profit: Number(r.casino_profit),
        bets_count: Number(r.bets_count),
        online_players: Number(r.online_players),
        created_at: new Date(r.created_at).toISOString(),
      }))
      .reverse(); // Revertir para gráfica: izquierda=antiguo, derecha=reciente
  }

  getConnectionsStatus(): any[] {
    return Array.from(this.connections.entries()).map(([bookmakerId, connection]) => ({
      bookmakerId,
      status: connection.status,
      lastPing: connection.lastPing,
      roundData: this.roundData.get(bookmakerId),
    }));
  }
}
