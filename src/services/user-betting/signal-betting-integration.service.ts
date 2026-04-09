import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBettingSession } from '../../entities/user-betting-session.entity';
import { UserBettingService } from './user-betting.service';
import { UserBettingGateway } from '../../gateways/user-betting.gateway';
import { StrategySignal } from '../../entities/strategy-signal.entity';
import { CreditsService } from '../credits/credits.service';

/**
 * Servicio que integra las señales de estrategias con las apuestas automáticas
 * Es invocado directamente desde StrategiesService cuando se detecta una señal
 */
@Injectable()
export class SignalBettingIntegrationService implements OnModuleDestroy {
  private readonly logger = new Logger(SignalBettingIntegrationService.name);

  constructor(
    @InjectRepository(UserBettingSession)
    private sessionRepo: Repository<UserBettingSession>,
    @InjectRepository(StrategySignal)
    private signalRepo: Repository<StrategySignal>,
    private bettingService: UserBettingService,
    private bettingGateway: UserBettingGateway,
    private creditsService: CreditsService,
  ) {
    // Exponer instancia globalmente para que StrategiesService pueda llamarla
    (global as any).signalBettingIntegration = this;
    this.logger.log('🎯 Signal-Betting Integration initialized');
  }

  onModuleDestroy() {
    delete (global as any).signalBettingIntegration;
  }

  /**
   * Maneja una nueva señal detectada
   * Busca sesiones activas para el bookmaker y dispara apuestas
   */
  async handleSignal(payload: {
    bookmakerId: number;
    bookmakerName: string;
    targetMultiplier: number;
    roundId: string;
    strategyName: string;
    signalId?: string;
  }): Promise<void> {
    this.logger.log(`📡 Signal received: ${payload.bookmakerName} @ ${payload.targetMultiplier}x`);

    try {
      // Buscar sesiones activas para este bookmaker
      const activeSessions = await this.sessionRepo.find({
        where: {
          bookmakerId: payload.bookmakerId,
          status: 'ACTIVE',
        },
        relations: ['auth'],
      });

      if (activeSessions.length === 0) {
        this.logger.debug(`No active sessions for bookmaker ${payload.bookmakerId}`);
        return;
      }

      this.logger.log(`🎯 Found ${activeSessions.length} active sessions for ${payload.bookmakerName}`);

      // Disparar apuesta para cada sesión activa
      for (const session of activeSessions) {
        try {
          // Verificar que el target de la señal coincide con el configurado
          // (o es menor, para no arriesgar más de lo configurado)
          if (payload.targetMultiplier < session.targetMultiplier) {
            this.logger.debug(
              `Session ${session.id}: Signal target ${payload.targetMultiplier}x < configured ${session.targetMultiplier}x, skipping`
            );
            continue;
          }

          // Colocar apuesta
          const history = await this.bettingService.placeBet(
            session.id,
            payload.signalId,
            payload.strategyName
          );

          this.logger.log(
            `✅ Bet placed for session ${session.id}: $${session.betAmount} @ ${session.targetMultiplier}x`
          );

          // Notificar al usuario via WebSocket
          this.bettingGateway.emitBetResult(session.id, {
            type: 'bet_placed',
            sessionId: session.id,
            roundId: payload.roundId,
            betAmount: session.betAmount,
            targetMultiplier: session.targetMultiplier,
            strategyName: payload.strategyName,
          });

        } catch (error: any) {
          this.logger.error(
            `Failed to place bet for session ${session.id}: ${error.message}`
          );

          // Notificar error al usuario
          this.bettingGateway.emitBetResult(session.id, {
            type: 'bet_error',
            sessionId: session.id,
            error: error.message,
          });
        }
      }
    } catch (error: any) {
      this.logger.error(`Error handling signal: ${error.message}`);
    }
  }

  /**
   * Procesa el resultado de una ronda
   * Busca apuestas pendientes y actualiza sus resultados
   */
  async processRoundResult(payload: {
    bookmakerId: number;
    roundId: string;
    resultMultiplier: number;
  }): Promise<void> {
    this.logger.debug(
      `Round result: ${payload.roundId} = ${payload.resultMultiplier}x for bookmaker ${payload.bookmakerId}`
    );

    try {
      // Buscar sesiones activas con apuestas pendientes
      const sessions = await this.sessionRepo.find({
        where: {
          bookmakerId: payload.bookmakerId,
          status: 'ACTIVE',
          wsStatus: 'BETTING',
        },
      });

      for (const session of sessions) {
        const isWin = payload.resultMultiplier >= session.targetMultiplier;
        const status = isWin ? 'WIN' : 'LOSS';
        const profit = isWin 
          ? session.betAmount * (session.targetMultiplier - 1) 
          : -session.betAmount;

        await this.bettingService.processBetResult(
          session.id,
          payload.roundId,
          payload.resultMultiplier,
          status
        );

        // Deducir crédito si ganó (similar a señales manuales)
        if (isWin) {
          this.creditsService.deductCreditsOnAutoBetWin(
            session.userId,
            session.id,
            session.totalBets,
            payload.resultMultiplier,
            profit
          ).catch(err => this.logger.warn(`⚠️ No se pudo deducir crédito: ${err.message}`));
        }

        // Notificar al usuario
        this.bettingGateway.emitBetResult(session.id, {
          type: 'bet_result',
          sessionId: session.id,
          roundId: payload.roundId,
          resultMultiplier: payload.resultMultiplier,
          status,
          profit,
        });

        this.logger.log(
          `📊 Result processed for session ${session.id}: ${status} @ ${payload.resultMultiplier}x`
        );
      }
    } catch (error: any) {
      this.logger.error(`Error processing round result: ${error.message}`);
    }
  }

  /**
   * Obtiene estadísticas de apuestas automáticas
   */
  async getStats(bookmakerId?: number): Promise<{
    totalSessions: number;
    activeSessions: number;
    totalBets: number;
    totalProfit: number;
    winRate: number;
  }> {
    const query = this.sessionRepo.createQueryBuilder('session');

    if (bookmakerId) {
      query.where('session.bookmakerId = :bookmakerId', { bookmakerId });
    }

    const sessions = await query.getMany();

    const activeSessions = sessions.filter(s => s.status === 'ACTIVE').length;
    const totalBets = sessions.reduce((sum, s) => sum + s.totalBets, 0);
    const totalProfit = sessions.reduce((sum, s) => sum + s.totalProfit, 0);
    const totalWins = sessions.reduce((sum, s) => sum + s.wins, 0);
    const totalLosses = sessions.reduce((sum, s) => sum + s.losses, 0);
    const winRate = totalWins + totalLosses > 0 
      ? (totalWins / (totalWins + totalLosses)) * 100 
      : 0;

    return {
      totalSessions: sessions.length,
      activeSessions,
      totalBets,
      totalProfit,
      winRate,
    };
  }
}
