import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StrategySignal as StrategySignalEntity } from '../../entities/strategy-signal.entity';
import { UserSignalsService } from '../user-signals.service';
import { AviatorGateway } from '../../gateways/aviator.gateway';
import { CreditsService } from '../credits/credits.service';
import { HostedUserAlertService } from '../hosted-user-alert.service';

export interface StrategySignal {
  bookmakerName: string;
  target: number;
  signal: boolean;
  finalnum?: number;
  message?: string;
  roundId?: string;
}

export interface RoundData {
  max_multiplier: number;
  timestamp: string;
}

// Base Strategy Class
abstract class BaseStrategy {
  name: string;
  target: number;
  entradaEnCurso: boolean = false;
  esperandoResultado: number = 0;
  galePendiente: boolean = false;
  galesMax: number = 1;
  msgIdGale: string | null = null;
  roundIdSeñal: string | null = null;
  ultimoWinTime: Date | null = null;
  currentDbSignalId: string | null = null;
  triggerMultiplier: number | null = null;
  ultimoRoundIdProcesado: string | null = null;
  ultimoRoundIdSeñal: string | null = null;

  constructor(name: string, target: number = 1.5) {
    this.name = name;
    this.target = target;
  }

  abstract checkSignal(results: number[], timestamps: string[], roundIds: string[]): StrategySignal | null;

  resetEstado(): void {
    this.entradaEnCurso = false;
    this.esperandoResultado = 0;
    this.galePendiente = false;
    this.roundIdSeñal = null;
    this.ultimoWinTime = null;
    this.currentDbSignalId = null;
    this.triggerMultiplier = null;
  }

  puedeGenerarSeñal(): boolean {
    if (!this.ultimoWinTime) return true;
    const ahora = new Date();
    const tiempoTranscurrido = (ahora.getTime() - this.ultimoWinTime.getTime()) / 1000;
    return tiempoTranscurrido >= 5;
  }
}

// StrategyOriginal: +1m 33s tras un +10.00x
class StrategyOriginal extends BaseStrategy {
  private predicciones: Date[] = [];

  constructor() {
    super('Estrategia 1', 1.50);
  }

  checkSignal(results: number[], timestamps: string[], roundIds: string[]): StrategySignal | null {
    const now = new Date();

    if (results[0] > 10.0) {
      const tsStr = timestamps[0].split(', ')[1] || timestamps[0].substring(11, 19);
      try {
        const horaEvento = this.parseTime(tsStr);
        const pred = new Date(horaEvento.getTime() + (1 * 60 + 33) * 1000);
        if (!this.predicciones.some(p => p.getTime() === pred.getTime())) {
          this.predicciones.push(pred);
          this.logger.log(`[${this.name}] Predicción guardada: ${pred.toTimeString().substring(0, 8)}`);
        }
      } catch (error) {
        this.logger.error(`Error parsing timestamp: ${error}`);
      }
    }

    for (let i = this.predicciones.length - 1; i >= 0; i--) {
      const pred = this.predicciones[i];
      if (Math.abs((now.getTime() - pred.getTime()) / 1000) <= 10) {
        this.predicciones.splice(i, 1);
        return {
          bookmakerName: this.name,
          target: this.target,
          signal: true,
          finalnum: results[0],
          message: `Señal detectada después de ${results[0]}x`
        };
      }
    }

    return null;
  }

  private parseTime(timeStr: string): Date {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const now = new Date();
    now.setHours(hours, minutes, seconds, 0);
    return now;
  }

  private logger = new Logger(StrategyOriginal.name);
}

// StrategyMelbet: Se activa en minutos específicos
class StrategyMelbet extends BaseStrategy {
  private intervalos: number[] = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  private logger = new Logger(StrategyMelbet.name);

  constructor() {
    super('Estrategia 2', 1.50);
  }

  checkSignal(results: number[], timestamps: string[], roundIds: string[]): StrategySignal | null {
    if (results.length < 1 || timestamps.length < 1) return null;

    const now = new Date(timestamps[0]);
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    
    if (this.ultimoRoundIdSeñal === roundIds[0]) return null;

    const serverTime = new Date();
    const diffMs = Math.abs(serverTime.getTime() - now.getTime());
    if (diffMs > 600000) return null;

    if (this.intervalos.includes(currentMinute) && currentSecond < 15) {
      this.logger.log(`⏰ [${this.name}] Activado por tiempo: ${currentMinute}:${currentSecond}`);
      this.ultimoRoundIdSeñal = roundIds[0];
      return {
        bookmakerName: this.name,
        target: this.target,
        signal: true,
        finalnum: results[0],
        message: `ACTIVADO POR TIEMPO - Minuto ${currentMinute}`
      };
    }
    
    return null;
  }
}

// Strategy1xbet: Patrón cada 5 minutos desde minuto 38
class Strategy1xbet extends BaseStrategy {
  private anchorMin: number = 38;
  private logger = new Logger(Strategy1xbet.name);

  constructor() {
    super('Estrategia 3', 1.50);
  }

  checkSignal(results: number[], timestamps: string[], roundIds: string[]): StrategySignal | null {
    if (results.length < 1 || timestamps.length < 1) return null;

    const now = new Date(timestamps[0]);
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    
    if (this.ultimoRoundIdSeñal === roundIds[0]) return null;

    const serverTime = new Date();
    if (Math.abs(serverTime.getTime() - now.getTime()) > 600000) return null;

    if ((currentMinute - this.anchorMin) % 5 === 0 && currentSecond < 15) {
      this.logger.log(`⏰ [${this.name}] Activado por patrón: ${currentMinute}:${currentSecond}`);
      this.ultimoRoundIdSeñal = roundIds[0];
      return {
        bookmakerName: this.name,
        target: this.target,
        signal: true,
        finalnum: results[0],
        message: `ACTIVADO POR PATRÓN - Minuto ${currentMinute}`
      };
    }
    
    return null;
  }
}

// StrategyDada: Basado en segundo decimal
class StrategyDada extends BaseStrategy {
  private predicciones: Date[] = [];

  constructor() {
    super('Estrategia 4', 1.50);
  }

  checkSignal(results: number[], timestamps: string[], roundIds: string[]): StrategySignal | null {
    const r = results[0];

    if (r > 3.0) {
      const decimalPart = r.toString().split('.')[1] || '0';
      if (decimalPart.length >= 2) {
        const segundoDecimal = parseInt(decimalPart[1], 10);
        const tsStr = timestamps[0].split(', ')[1] || timestamps[0].substring(11, 19);
        try {
          const baseTime = this.parseTime(tsStr);
          const pred = new Date(baseTime.getTime() + segundoDecimal * 60 * 1000);
          if (!this.predicciones.some(p => p.getTime() === pred.getTime())) {
            this.predicciones.push(pred);
          }
        } catch (error) {
          this.logger.error(`Error parsing timestamp: ${error}`);
        }
      }
    }

    const now = new Date();
    for (let i = this.predicciones.length - 1; i >= 0; i--) {
      const pred = this.predicciones[i];
      if (Math.abs((now.getTime() - pred.getTime()) / 1000) <= 15) {
        this.predicciones.splice(i, 1);
        return {
          bookmakerName: this.name,
          target: this.target,
          signal: true,
          finalnum: results[0],
          message: `Señal segundo decimal`
        };
      }
    }

    return null;
  }

  private parseTime(timeStr: string): Date {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const now = new Date();
    now.setHours(hours, minutes, seconds, 0);
    return now;
  }

  private logger = new Logger(StrategyDada.name);
}

// StrategyAviatorPro: Horarios específicos
class StrategyAviatorPro extends BaseStrategy {
  private schedule: number[] = [1, 5, 8, 16, 18, 22, 25, 34, 36, 38, 43, 46, 47, 50, 54, 56, 57];
  private logger = new Logger(StrategyAviatorPro.name);

  constructor() {
    super('Estrategia 5', 1.50);
  }

  checkSignal(results: number[], timestamps: string[], roundIds: string[]): StrategySignal | null {
    if (results.length < 1 || timestamps.length < 1) return null;

    const now = new Date(timestamps[0]);
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();

    if (this.ultimoRoundIdSeñal === roundIds[0]) return null;

    const serverTime = new Date();
    if (Math.abs(serverTime.getTime() - now.getTime()) > 600000) return null;

    if (this.schedule.includes(currentMinute) && currentSecond < 15) {
      this.logger.log(`⏰ [${this.name}] Activado por horario: ${currentMinute}:${currentSecond}`);
      this.ultimoRoundIdSeñal = roundIds[0];
      return {
        bookmakerName: this.name,
        target: this.target,
        signal: true,
        finalnum: results[0],
        message: `ACTIVADO POR HORARIO - Minuto ${currentMinute}`
      };
    }
    
    return null;
  }
}

// StrategyAlpha: Offsets de 3, 6, 9, 12 minutos
class StrategyAlpha extends BaseStrategy {
  private offsets: number[] = [3, 6, 9, 12];
  private pendientes: Date[] = [];
  private ultimaSenyalTime: Date | null = null;

  constructor() {
    super('Estrategia 6', 1.50);
  }

  checkSignal(results: number[], timestamps: string[], roundIds: string[]): StrategySignal | null {
    // NO generar señal si ya hay una entrada en curso o se generó una recientemente
    if (this.entradaEnCurso || this.galePendiente) return null;
    
    // Cooldown de 30 segundos después de una señal
    if (this.ultimaSenyalTime) {
      const tiempoTranscurrido = (new Date().getTime() - this.ultimaSenyalTime.getTime()) / 1000;
      if (tiempoTranscurrido < 30) return null;
    }

    if (results[0] > 2.0) {
      const tsStr = timestamps[0].split(', ')[1] || timestamps[0].substring(11, 19);
      try {
        const baseTime = this.parseTime(tsStr);
        for (const off of this.offsets) {
          const p = new Date(baseTime.getTime() + off * 60 * 1000);
          if (!this.pendientes.some(pend => pend.getTime() === p.getTime())) {
            this.pendientes.push(p);
          }
        }
      } catch (error) {
        this.logger.error(`Error parsing timestamp: ${error}`);
      }
    }

    const now = new Date();
    for (let i = this.pendientes.length - 1; i >= 0; i--) {
      const pred = this.pendientes[i];
      if (Math.abs((now.getTime() - pred.getTime()) / 1000) <= 15) {
        this.pendientes.splice(i, 1);
        this.ultimaSenyalTime = new Date();
        return {
          bookmakerName: this.name,
          target: this.target,
          signal: true,
          finalnum: results[0],
          message: `Señal offset`
        };
      }
    }

    return null;
  }

  private parseTime(timeStr: string): Date {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const now = new Date();
    now.setHours(hours, minutes, seconds, 0);
    return now;
  }

  private logger = new Logger(StrategyAlpha.name);
}

// StrategyTracker: Detección de ≥2 resultados ≥5.0x
class StrategyTracker extends BaseStrategy {
  private lastTriggered: Date | null = null;

  constructor() {
    super('Estrategia 7', 1.50);
  }

  checkSignal(results: number[], timestamps: string[], roundIds: string[]): StrategySignal | null {
    const highResults = results.filter(r => r >= 5.0);
    
    if (highResults.length >= 2) {
      const now = new Date();
      if (!this.lastTriggered || (now.getTime() - this.lastTriggered.getTime()) / 1000 > 60) {
        this.lastTriggered = now;
        return {
          bookmakerName: this.name,
          target: this.target,
          signal: true,
          finalnum: results[0],
          message: `Señal tracker: ${highResults.length} resultados ≥5.0x`
        };
      }
    }

    return null;
  }
}

// StrategyInterval: Cálculo de intervalos entre 10x
class StrategyInterval extends BaseStrategy {
  private roses: Date[] = [];

  constructor() {
    super('Estrategia 8', 1.50);
  }

  checkSignal(results: number[], timestamps: string[], roundIds: string[]): StrategySignal | null {
    if (results[0] >= 10.0) {
      const tsStr = timestamps[0].split(', ')[1] || timestamps[0].substring(11, 19);
      try {
        const roseTime = this.parseTime(tsStr);
        if (this.roses.length === 0 || roseTime.getTime() > this.roses[0].getTime()) {
          this.roses.unshift(roseTime);
          if (this.roses.length > 2) {
            this.roses.pop();
          }
        }
      } catch (error) {
        this.logger.error(`Error parsing timestamp: ${error}`);
      }
    }

    if (this.roses.length === 2) {
      const intervalo = Math.round((this.roses[0].getTime() - this.roses[1].getTime()) / 60000) + 1;
      const pred = new Date(this.roses[0].getTime() + intervalo * 60 * 1000);
      
      if (Math.abs((new Date().getTime() - pred.getTime()) / 1000) <= 15) {
        this.roses = [new Date()];
        return {
          bookmakerName: this.name,
          target: this.target,
          signal: true,
          finalnum: results[0],
          message: `Señal intervalo: ${intervalo} minutos`
        };
      }
    }

    return null;
  }

  private parseTime(timeStr: string): Date {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const now = new Date();
    now.setHours(hours, minutes, seconds, 0);
    return now;
  }

  private logger = new Logger(StrategyInterval.name);
}

@Injectable()
export class StrategiesService {
  private readonly logger = new Logger(StrategiesService.name);
  private strategies: BaseStrategy[] = [];
  private strategiesByBookmaker: Map<number, BaseStrategy[]> = new Map();

  constructor(
    @InjectRepository(StrategySignalEntity)
    private strategySignalRepo: Repository<StrategySignalEntity>,
    @Inject(forwardRef(() => UserSignalsService))
    private userSignalsService: UserSignalsService,
    @Inject(forwardRef(() => AviatorGateway))
    private aviatorGateway: AviatorGateway,
    @Inject(forwardRef(() => CreditsService))
    private creditsService: CreditsService,
    @Inject(forwardRef(() => HostedUserAlertService))
    private hostedUserAlertService: HostedUserAlertService
  ) {
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    this.strategies = [
      new StrategyOriginal(),
      new StrategyMelbet(),
      new Strategy1xbet(),
      new StrategyDada(),
      new StrategyAviatorPro(),
      new StrategyTracker(),
      new StrategyInterval()
    ];
    this.logger.log(`🎮 [STRATEGIES] ${this.strategies.length} estrategias inicializadas`);
  }

  private getStrategiesForBookmaker(bookmakerId: number): BaseStrategy[] {
    if (!this.strategiesByBookmaker.has(bookmakerId)) {
      const newStrategies = [
        new StrategyOriginal(),
        new StrategyMelbet(),
        new Strategy1xbet(),
        new StrategyDada(),
        new StrategyAviatorPro(),
        new StrategyTracker(),
        new StrategyInterval()
      ];
      this.strategiesByBookmaker.set(bookmakerId, newStrategies);
      this.logger.log(`🆕 [STRATEGIES] Estrategias creadas para bookmaker ${bookmakerId}`);
    }
    return this.strategiesByBookmaker.get(bookmakerId)!;
  }

  async health(): Promise<{ status: string }> {
    return { status: 'ok' };
  }

  async analyzeStrategiesWithState(results: number[], timestamps: string[], roundIds: string[], bookmakerId: number): Promise<{
    updates: Array<{
      signal: boolean;
      strategy?: string;
      target?: number;
      message?: string;
      timestamp: string;
      bookmakerId: number;
      status?: 'SI' | 'NO' | 'WIN' | 'GALE' | 'ESPERANDO' | 'LOSS';
      result?: number;
      roundId?: string;
    }>;
  }> {
    try {
      // LOG DETALLADO: Mostrar los 5 resultados más recientes por bookmaker
      this.logger.log(`\n========================================`);
      this.logger.log(`🎮 [STRATEGIES] Análisis para BOOKMAKER ${bookmakerId}`);
      this.logger.log(`📊 Resultados recibidos: ${results.length}`);
      this.logger.log(`🔝 Últimos 5 resultados:`);
      const last5 = results.slice(0, 5);
      const last5Rounds = roundIds.slice(0, 5);
      const last5Times = timestamps.slice(0, 5);
      last5.forEach((r, i) => {
        this.logger.log(`   ${i + 1}. Round ${last5Rounds[i]}: ${r}x - ${last5Times[i]}`);
      });
      this.logger.log(`========================================\n`);
      
      const strategies = this.getStrategiesForBookmaker(bookmakerId);
      const allUpdates: any[] = [];
      
      const ultimo = results[0];
      const ultimoRoundId = roundIds[0];

      // LOG: Mostrar estado de todas las estrategias
      this.logger.log(`📊 [ESTADO ESTRATEGIAS] Bookmaker ${bookmakerId}:`);
      strategies.forEach(s => {
        this.logger.log(`   ${s.name}: entradaEnCurso=${s.entradaEnCurso}, galePendiente=${s.galePendiente}, roundIdSeñal=${s.roundIdSeñal}`);
      });

      // 1. Procesar estrategias con entradas en curso
      for (const strategy of strategies) {
        if (strategy.entradaEnCurso) {
          this.logger.log(`⚠️ [ALERTA] ${strategy.name} tiene entradaEnCurso=true - Round actual: ${ultimoRoundId}, Round señal: ${strategy.roundIdSeñal}`);
          const resultadoProcesado = this.procesarEstrategia(strategy, ultimo, ultimoRoundId, bookmakerId);
          
          if (resultadoProcesado) {
            // Emitir resultado por WebSocket
            this.logger.log(`🎯 [RESULTADO] ${resultadoProcesado.status} - ${strategy.name}: ${resultadoProcesado.message}`);
            
            try {
              // Obtener usuarios activos para incluir en la emisión
              const activeUsers = this.aviatorGateway.getUsersWithActiveSignalSession(bookmakerId);
              const primaryUser = activeUsers.length > 0 ? activeUsers[0] : null;
              
              this.aviatorGateway.emitPrediction(bookmakerId, {
                prediction: strategy.target,
                score: 100,
                apostar: resultadoProcesado.status,
                round_id: resultadoProcesado.roundId || ultimoRoundId,
                bookmakerName: strategy.name,
                message: resultadoProcesado.message,
                timestamp: new Date().toISOString(),
                result: resultadoProcesado.result,
                userId: primaryUser?.userId || null
              });
            } catch (emitError) {
              this.logger.error(`Error emitiendo resultado: ${emitError.message}`);
            }
            
            allUpdates.push({
              signal: resultadoProcesado.status === 'GALE',
              bookmakerName: strategy.name,
              target: strategy.target,
              message: resultadoProcesado.message,
              status: resultadoProcesado.status,
              result: ultimo,
              timestamp: new Date().toISOString(),
              bookmakerId,
              roundId: strategy.roundIdSeñal || undefined
            });
          }
        }
      }

      // 2. Buscar nuevas señales
      let signalGeneratedThisRound = strategies.some(s => s.entradaEnCurso || s.roundIdSeñal === ultimoRoundId);

      for (const strategy of strategies) {
        if (signalGeneratedThisRound) break;

        if (strategy.ultimoWinTime && !strategy.entradaEnCurso && !strategy.galePendiente) {
          if (!strategy.puedeGenerarSeñal()) continue;
        }

        const signal = strategy.checkSignal(results, timestamps, roundIds);
        if (signal) {
          if (strategy.galePendiente) {
            strategy.entradaEnCurso = true;
            strategy.galePendiente = false;
            signalGeneratedThisRound = true;
            allUpdates.push({
              signal: true,
              bookmakerName: strategy.name,
              target: strategy.target,
              message: `GALE ${strategy.esperandoResultado} - Cobrar: ${strategy.target}x`,
              status: 'SI',
              timestamp: new Date().toISOString(),
              bookmakerId,
              roundId: strategy.roundIdSeñal || roundIds[0]
            });
          } else if (!strategy.entradaEnCurso) {
            this.logger.log(`✅ [PYTHON-STATE] ${strategy.name} SEÑAL - Cobrar: ${strategy.target}x`);
            strategy.entradaEnCurso = true;
            strategy.esperandoResultado = 0;
            strategy.roundIdSeñal = roundIds[0];
            strategy.ultimoRoundIdSeñal = roundIds[0];
            strategy.triggerMultiplier = signal.finalnum || null;
            signalGeneratedThisRound = true;
            
            // Emitir señal por WebSocket
            try {
              // Obtener usuarios activos para incluir en la emisión
              const activeUsers = this.aviatorGateway.getUsersWithActiveSignalSession(bookmakerId);
              const primaryUser = activeUsers.length > 0 ? activeUsers[0] : null;
              
              this.aviatorGateway.emitPrediction(bookmakerId, {
                prediction: strategy.target,
                score: 100,
                apostar: 'SI',
                round_id: strategy.roundIdSeñal || roundIds[0],
                bookmakerName: strategy.name,
                message: `Cobrar: ${strategy.target}x`,
                timestamp: new Date().toISOString(),
                userId: primaryUser?.userId || null
              });
              this.logger.log(`📡 Señal emitida por WebSocket: ${strategy.name} - Usuario: ${primaryUser?.email || 'Global'}`);
            } catch (error) {
              this.logger.error(`Error emitiendo señal: ${error.message}`);
            }
            
            allUpdates.push({
              signal: true,
              bookmakerName: strategy.name,
              target: strategy.target,
              message: `SEÑAL INMEDIATA - Cobrar: ${strategy.target}x`,
              status: 'SI',
              timestamp: new Date().toISOString(),
              bookmakerId,
              roundId: strategy.roundIdSeñal
            });

            // Guardar señal en BD de forma SÍNCRONA
            try {
              const exists = await this.strategySignalRepo.findOne({ 
                where: { bookmakerId, roundId: strategy.roundIdSeñal, bookmakerName: strategy.name }
              });
              
              if (exists) {
                strategy.currentDbSignalId = exists.id;
                this.logger.log(`📌 Señal ya existe: ${exists.id}`);
              } else {
                // Obtener usuarios activos para asignar la señal al crearla
                const activeUsers = this.aviatorGateway.getUsersWithActiveSignalSession(bookmakerId);
                const primaryUser = activeUsers.length > 0 ? activeUsers[0] : null;
                
                const saved = await this.strategySignalRepo.save(this.strategySignalRepo.create({
                  bookmakerId,
                  bookmakerName: strategy.name,
                  triggerTime: new Date(),
                  triggerMultiplier: strategy.triggerMultiplier ?? undefined,
                  roundId: strategy.roundIdSeñal ?? undefined,
                  targetMultiplier: strategy.target,
                  status: 'PENDING',
                  type: 'ESPERANDO',
                  // Asignar usuario si hay sesión activa
                  userId: primaryUser?.userId,
                  userEmail: primaryUser?.email
                }));
                strategy.currentDbSignalId = saved.id;
                this.logger.log(`💾 Señal guardada: ${saved.id} - ${strategy.name} - Usuario: ${primaryUser?.email || 'Global'}`);
                
                // Verificar si el usuario está alojado y emitir alerta
                if (primaryUser?.userId) {
                  try {
                    await this.hostedUserAlertService.emitHostedUserAlert(
                      primaryUser.userId,
                      primaryUser.email,
                      bookmakerId,
                      strategy.name,
                      saved.id,
                      strategy.target
                    );
                  } catch (alertError) {
                    this.logger.error(`Error emitiendo alerta de usuario alojado: ${alertError.message}`);
                  }
                }
              }
            } catch (dbError) {
              this.logger.error(`Error guardando señal: ${dbError.message}`);
            }
          }
        }
      }

      return { updates: allUpdates };
    } catch (err) {
      this.logger.error(`Strategy analysis failed: ${err?.message || err}`);
      throw err;
    }
  }

  private procesarEstrategia(strategy: BaseStrategy, resultado: number, roundId: string, bookmakerId: number): { 
    status: 'WIN' | 'LOSS' | 'GALE'; 
    message: string;
    bookmakerName: string;
    result: number;
    roundId: string | null;
  } | null {
    if (!strategy.entradaEnCurso) return null;

    if (strategy.roundIdSeñal !== null && roundId === strategy.roundIdSeñal) return null;
    if (strategy.ultimoRoundIdProcesado === roundId) return null;

    strategy.ultimoRoundIdProcesado = roundId;

    if (resultado >= strategy.target) {
      let typeWin = strategy.esperandoResultado === 0 ? 'CERTEIRO' : `GALE ${strategy.esperandoResultado}`;
      
      // Guardar ID antes de resetear para evitar race condition
      const signalId = strategy.currentDbSignalId;
      
      if (signalId) {
        // Obtener usuarios activos para asignar la señal
        const activeUsers = this.aviatorGateway.getUsersWithActiveSignalSession(bookmakerId);
        const primaryUser = activeUsers.length > 0 ? activeUsers[0] : null;
        
        this.strategySignalRepo.update(signalId, {
          status: 'WIN',
          resultMultiplier: resultado,
          type: typeWin,
          // NO sobrescribir roundId - mantener el original de la señal
          // Asignar usuario solo en WIN/LOSS
          userId: primaryUser?.userId,
          userEmail: primaryUser?.email
        }).then(() => {
          this.logger.log(`✅ [WIN] Señal ${signalId} actualizada - Resultado: ${resultado}x - Usuario: ${primaryUser?.email || 'N/A'}`);
        }).catch(err => this.logger.error(`Error updating DB WIN: ${err.message}`));

        this.userSignalsService.processSignalResult(
          signalId,
          resultado,
          'win',
          strategy.esperandoResultado
        ).catch(err => this.logger.error(`Error processing signal result: ${err.message}`));

        // Deducir crédito al usuario que tomó la señal (solo en WIN)
        if (primaryUser?.userId) {
          this.creditsService.deductCreditsOnSignalWin(
            primaryUser.userId,
            signalId,
            strategy.name
          ).catch(err => this.logger.warn(`⚠️ No se pudo deducir crédito: ${err.message}`));
        }
      }
      
      strategy.ultimoWinTime = new Date();
      // Guardar roundId ANTES de resetear para emitir correctamente
      const roundIdForEmit = strategy.roundIdSeñal;
      strategy.resetEstado();
      return { 
        status: 'WIN', 
        bookmakerName: strategy.name,
        message: `✅ WIN - ${resultado}x`,
        result: resultado,
        roundId: roundIdForEmit
      };
    }

    if (strategy.esperandoResultado < strategy.galesMax) {
      strategy.esperandoResultado++;
      strategy.galePendiente = true;
      return { 
        status: 'GALE', 
        bookmakerName: strategy.name,
        message: `❌ LOSS ${resultado}x - GALE ${strategy.esperandoResultado}`,
        result: resultado,
        roundId: strategy.roundIdSeñal
      };
    }

    // Guardar ID antes de resetear para evitar race condition
    const signalId = strategy.currentDbSignalId;
    
    if (signalId) {
      // Obtener usuarios activos para asignar la señal
      const activeUsers = this.aviatorGateway.getUsersWithActiveSignalSession(bookmakerId);
      const primaryUser = activeUsers.length > 0 ? activeUsers[0] : null;
      
      this.strategySignalRepo.update(signalId, {
        status: 'LOSS',
        resultMultiplier: resultado,
        type: 'RED',
        // NO sobrescribir roundId - mantener el original de la señal
        // Asignar usuario solo en WIN/LOSS
        userId: primaryUser?.userId,
        userEmail: primaryUser?.email
      }).then(() => {
        this.logger.log(`❌ [LOSS] Señal ${signalId} actualizada - Resultado: ${resultado}x - Usuario: ${primaryUser?.email || 'N/A'}`);
      }).catch(err => this.logger.error(`Error updating DB LOSS: ${err.message}`));

      this.userSignalsService.processSignalResult(
        signalId,
        resultado,
        'loss',
        strategy.esperandoResultado
      ).catch(err => this.logger.error(`Error processing signal result: ${err.message}`));
    }
    
    // Guardar roundId ANTES de resetear para emitir correctamente
    const roundIdForEmit = strategy.roundIdSeñal;
    strategy.resetEstado();
    return { 
      status: 'LOSS', 
      bookmakerName: strategy.name,
      message: `❌ LOSS DEFINITIVO - ${resultado}x`,
      result: resultado,
      roundId: roundIdForEmit
    };
  }

  getStrategiesStatus(): any[] {
    return this.strategies.map(s => ({
      name: s.name,
      target: s.target,
      entradaEnCurso: s.entradaEnCurso,
      esperandoResultado: s.esperandoResultado,
      galePendiente: s.galePendiente
    }));
  }

  getStrategiesStatusForBookmaker(bookmakerId: number): any[] {
    const strategies = this.getStrategiesForBookmaker(bookmakerId);
    return strategies.map(s => ({
      name: s.name,
      target: s.target,
      entradaEnCurso: s.entradaEnCurso,
      esperandoResultado: s.esperandoResultado,
      galePendiente: s.galePendiente
    }));
  }

  resetStrategy(strategyName: string): boolean {
    const strategy = this.strategies.find(s => s.name === strategyName);
    if (strategy) {
      strategy.resetEstado();
      return true;
    }
    return false;
  }

  resetStrategyForBookmaker(bookmakerId: number, strategyName: string): boolean {
    const strategies = this.getStrategiesForBookmaker(bookmakerId);
    const strategy = strategies.find(s => s.name === strategyName);
    if (strategy) {
      strategy.resetEstado();
      return true;
    }
    return false;
  }

  resetAllStrategies(): void {
    this.strategies.forEach(s => s.resetEstado());
  }

  resetAllStrategiesForBookmaker(bookmakerId: number): void {
    const strategies = this.getStrategiesForBookmaker(bookmakerId);
    strategies.forEach(s => s.resetEstado());
  }

  async getRecentSignals(bookmakerId: number, limit: number = 50): Promise<any[]> {
    try {
      const signals = await this.strategySignalRepo.find({
        where: { bookmakerId },
        order: { createdAt: 'DESC' },
        take: limit,
      });
      
      return signals.map(s => ({
        id: s.id,
        triggerTime: s.triggerTime,
        triggerMultiplier: s.triggerMultiplier,
        roundId: s.roundId,
        targetMultiplier: s.targetMultiplier,
        status: s.status,
        resultMultiplier: s.resultMultiplier,
        type: s.type,
        createdAt: s.createdAt,
      }));
    } catch (error) {
      this.logger.error(`Error getting recent signals: ${error.message}`);
      return [];
    }
  }
}
