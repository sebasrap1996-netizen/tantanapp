import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserBookmakerAuth } from '../../entities/user-bookmaker-auth.entity';
import { UserBettingSession } from '../../entities/user-betting-session.entity';
import { UserBettingHistory } from '../../entities/user-betting-history.entity';
import { UserBettingWebSocketService } from './user-betting-websocket.service';
import { createAutoBetMessage, generateClientSeed } from '../../logic-apps/Aviator/encoder';
export interface CreateAuthDto {
  bookmakerId: number;
}

export interface CreateSessionDto {
  bookmakerId: number;
  betAmount: number;
  targetMultiplier: number;
  maxGales?: number;
}

export interface UpdateAuthConfigDto {
  defaultBetAmount?: number;
  defaultTargetMultiplier?: number;
  defaultMaxGales?: number;
  autoModeEnabled?: boolean;
}

@Injectable()
export class UserBettingService {
  private readonly logger = new Logger(UserBettingService.name);

  constructor(
    @InjectRepository(UserBookmakerAuth)
    private authRepo: Repository<UserBookmakerAuth>,
    @InjectRepository(UserBettingSession)
    private sessionRepo: Repository<UserBettingSession>,
    @InjectRepository(UserBettingHistory)
    private historyRepo: Repository<UserBettingHistory>,
    private wsService: UserBettingWebSocketService,
    private dataSource: DataSource,
  ) {}

  // ========== AUTH MANAGEMENT ==========

  /**
   * Inicializa o actualiza la configuración de un usuario para un bookmaker
   */
  async saveAuth(userId: string, dto: { bookmakerId: number }): Promise<UserBookmakerAuth> {
    // Buscar si ya existe
    let auth = await this.authRepo.findOne({
      where: { userId, bookmakerId: dto.bookmakerId }
    });

    if (!auth) {
      auth = this.authRepo.create({
        userId,
        bookmakerId: dto.bookmakerId,
        defaultBetAmount: 100,
        defaultTargetMultiplier: 1.5,
        defaultMaxGales: 1,
      });
    }

    return this.authRepo.save(auth);
  }

  /**
   * Obtiene todos los auths de un usuario
   */
  async getUserAuths(userId: string): Promise<UserBookmakerAuth[]> {
    return this.authRepo.find({
      where: { userId },
      relations: ['bookmaker'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtiene un auth específico
   */
  async getAuth(userId: string, bookmakerId: number): Promise<UserBookmakerAuth | null> {
    return this.authRepo.findOne({
      where: { userId, bookmakerId },
      relations: ['bookmaker'],
    });
  }

  /**
   * Verifica la conexión del bookmaker usando los datos globales
   */
  async verifyAuth(userId: string, bookmakerId: number): Promise<{ success: boolean; error?: string }> {
    const auth = await this.getAuth(userId, bookmakerId);
    if (!auth) {
      throw new NotFoundException('Configuración no encontrada');
    }

    try {
      // Usar el método que prueba la conexión con la config del administrador
      const result = await this.wsService.testConnectionWithAuth(auth, auth.bookmaker);

      if (result.success) {
        auth.connectionStatus = 'CONNECTED';
        auth.lastConnectionAt = new Date();
        auth.lastError = null;
      } else {
        auth.connectionStatus = 'ERROR';
        auth.lastError = result.error || 'Connection failed';
      }
      
      await this.authRepo.save(auth);
      return result;
    } catch (error: any) {
      auth.connectionStatus = 'ERROR';
      auth.lastError = error.message;
      await this.authRepo.save(auth);
      return { success: false, error: error.message };
    }
  }

  /**
   * Actualiza la configuración por defecto
   */
  async updateAuthConfig(userId: string, bookmakerId: number, dto: UpdateAuthConfigDto): Promise<UserBookmakerAuth> {
    const auth = await this.getAuth(userId, bookmakerId);
    if (!auth) {
      throw new NotFoundException('Auth no encontrado');
    }

    if (dto.defaultBetAmount !== undefined) auth.defaultBetAmount = dto.defaultBetAmount;
    if (dto.defaultTargetMultiplier !== undefined) auth.defaultTargetMultiplier = dto.defaultTargetMultiplier;
    if (dto.defaultMaxGales !== undefined) auth.defaultMaxGales = dto.defaultMaxGales;
    if (dto.autoModeEnabled !== undefined) auth.autoModeEnabled = dto.autoModeEnabled;

    return this.authRepo.save(auth);
  }

  /**
   * Elimina un auth
   */
  async deleteAuth(userId: string, bookmakerId: number): Promise<void> {
    const auth = await this.getAuth(userId, bookmakerId);
    if (!auth) return;

    // Verificar que no haya sesión activa
    const activeSession = await this.sessionRepo.findOne({
      where: { userId, bookmakerId, status: 'ACTIVE' }
    });

    if (activeSession) {
      throw new BadRequestException('No se puede eliminar mientras haya una sesión activa');
    }

    await this.authRepo.remove(auth);
  }

  /**
   * Obtiene el balance actual del usuario (almacenado localmente)
   */
  async getBookmakerBalance(userId: string, bookmakerId: number): Promise<{ balance: number; currency: string; success: boolean; error?: string }> {
    const auth = await this.getAuth(userId, bookmakerId);
    if (!auth) {
      throw new NotFoundException('Configuración no encontrada');
    }

    // Retorna el balance almacenado (se actualiza durante las sesiones)
    return {
      balance: (auth as any).currentBalance || 0,
      currency: (auth as any).currency || 'USD',
      success: true
    };
  }

  // ========== SESSION MANAGEMENT ==========

  /**
   * Crea una nueva sesión de apuestas automáticas
   */
  async createSession(userId: string, dto: CreateSessionDto): Promise<UserBettingSession> {
    // Verificar que existe el auth
    const auth = await this.getAuth(userId, dto.bookmakerId);
    if (!auth) {
      throw new NotFoundException('Debe configurar el auth message primero');
    }


    // Verificar que no haya sesión activa
    const activeSession = await this.sessionRepo.findOne({
      where: { userId, bookmakerId: dto.bookmakerId, status: 'ACTIVE' }
    });

    if (activeSession) {
      throw new BadRequestException('Ya existe una sesión activa para este bookmaker');
    }

    // Crear sesión
    const session = this.sessionRepo.create({
      userId,
      bookmakerId: dto.bookmakerId,
      authId: auth.id,
      betAmount: dto.betAmount,
      targetMultiplier: dto.targetMultiplier,
      maxGales: dto.maxGales ?? auth.defaultMaxGales,
      status: 'PENDING',
      wsStatus: 'DISCONNECTED',
      initialBalance: (auth as any).currentBalance ?? 0,
      currentBalance: (auth as any).currentBalance ?? 0,
    });

    return this.sessionRepo.save(session);
  }

  /**
   * Inicia una sesión de apuestas
   * Soporta tanto tokens de Spribe como authMessage tradicional
   */
  async startSession(userId: string, sessionId: string): Promise<UserBettingSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, userId },
      relations: ['auth', 'bookmaker'],
    });

    if (!session) {
      throw new NotFoundException('Sesión no encontrada');
    }

    if (session.status !== 'PENDING' && session.status !== 'PAUSED') {
      throw new BadRequestException(`No se puede iniciar sesión en estado ${session.status}`);
    }

    // Obtener el auth message apropiado (tokens de Spribe o authMessage tradicional)
    const authMessage = await this.wsService.getAuthMessageForSession(session.auth);
    
    if (!authMessage) {
      throw new BadRequestException('No hay método de autenticación configurado');
    }

    // Conectar WebSocket
    await this.wsService.connect(session, authMessage);

    session.status = 'ACTIVE';
    session.wsStatus = 'CONNECTED';
    session.startedAt = new Date();
    
    return this.sessionRepo.save(session);
  }

  /**
   * Pausa una sesión
   */
  async pauseSession(userId: string, sessionId: string): Promise<UserBettingSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Sesión no encontrada');
    }

    if (session.status !== 'ACTIVE') {
      throw new BadRequestException('Solo se puede pausar una sesión activa');
    }

    session.status = 'PAUSED';
    return this.sessionRepo.save(session);
  }

  /**
   * Detiene una sesión completamente
   */
  async stopSession(userId: string, sessionId: string): Promise<UserBettingSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Sesión no encontrada');
    }

    // Desconectar WebSocket
    await this.wsService.disconnect(sessionId);

    session.status = 'STOPPED';
    session.wsStatus = 'DISCONNECTED';
    session.stoppedAt = new Date();

    return this.sessionRepo.save(session);
  }

  /**
   * Obtiene el estado de una sesión
   */
  async getSessionStatus(userId: string, sessionId: string): Promise<UserBettingSession | null> {
    return this.sessionRepo.findOne({
      where: { id: sessionId, userId },
      relations: ['bookmaker', 'auth'],
    });
  }

  /**
   * Obtiene las sesiones activas de un usuario
   */
  async getActiveSessions(userId: string): Promise<UserBettingSession[]> {
    return this.sessionRepo.find({
      where: { userId, status: 'ACTIVE' },
      relations: ['bookmaker'],
      order: { startedAt: 'DESC' },
    });
  }

  /**
   * Obtiene el historial de sesiones
   */
  async getSessionHistory(userId: string, limit: number = 20): Promise<UserBettingSession[]> {
    return this.sessionRepo.find({
      where: { userId },
      relations: ['bookmaker'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // ========== BETTING ==========

  /**
   * Coloca una apuesta automáticamente
   * Llamado cuando se detecta una señal
   */
  async placeBet(sessionId: string, signalId?: string, strategyName?: string): Promise<UserBettingHistory> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['auth'],
    });

    if (!session || session.status !== 'ACTIVE') {
      throw new BadRequestException('Sesión no activa');
    }

    // Determinar el betId (1 o 2)
    const betId: 1 | 2 = session.currentBetId === 1 ? 2 : 1;

    // Generar mensaje de apuesta con auto-cashout
    const { base64, clientSeed } = createAutoBetMessage(
      session.betAmount,
      session.targetMultiplier,
      betId
    );

    // Enviar apuesta por WebSocket
    await this.wsService.sendBet(sessionId, base64);

    // Actualizar sesión
    session.currentBetId = betId;
    session.currentBetAmount = session.betAmount;
    session.currentGaleLevel = 0;
    session.totalBets++;
    session.wsStatus = 'BETTING';
    await this.sessionRepo.save(session);

    // Guardar en historial
    const history = this.historyRepo.create({
      sessionId,
      userId: session.userId,
      signalId,
      signalStrategy: strategyName,
      roundId: `pending-${Date.now()}`, // Se actualizará cuando se reciba confirmación
      betId,
      betAmount: session.betAmount,
      targetMultiplier: session.targetMultiplier,
      clientSeed,
      status: 'PLACED',
      betPlacedAt: new Date(),
    });

    return this.historyRepo.save(history);
  }

  /**
   * Procesa el resultado de una apuesta
   */
  async processBetResult(
    sessionId: string,
    roundId: string,
    resultMultiplier: number,
    status: 'WIN' | 'LOSS'
  ): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) return;

    // Buscar la apuesta pendiente
    const pendingBet = await this.historyRepo.findOne({
      where: { sessionId, status: 'PLACED' },
      order: { betPlacedAt: 'DESC' },
    });

    if (!pendingBet) return;

    // Calcular profit
    let profit = 0;
    if (status === 'WIN') {
      profit = session.betAmount * (resultMultiplier - 1);
      session.wins++;
      session.totalProfit += profit;
    } else {
      profit = -session.betAmount;
      session.losses++;
      session.totalProfit -= session.betAmount;
    }

    // Actualizar historial
    pendingBet.roundId = roundId;
    pendingBet.resultMultiplier = resultMultiplier;
    pendingBet.profit = profit;
    pendingBet.status = status === 'WIN' ? 'CASHOUT' : 'LOSS';
    pendingBet.resultAt = new Date();
    await this.historyRepo.save(pendingBet);

    // Actualizar sesión
    session.currentBalance += profit;
    session.wsStatus = 'WAITING';
    await this.sessionRepo.save(session);
  }

  /**
   * Obtiene el historial de apuestas de una sesión
   */
  async getSessionBets(sessionId: string, limit: number = 50): Promise<UserBettingHistory[]> {
    return this.historyRepo.find({
      where: { sessionId },
      order: { betPlacedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Obtiene el historial de apuestas de un usuario
   */
  async getUserBets(userId: string, limit: number = 50): Promise<UserBettingHistory[]> {
    return this.historyRepo.find({
      where: { userId },
      relations: ['session', 'session.bookmaker'],
      order: { betPlacedAt: 'DESC' },
      take: limit,
    });
  }
}
