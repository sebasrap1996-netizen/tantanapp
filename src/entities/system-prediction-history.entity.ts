import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Bookmaker } from './bookmaker.entity';
import { StrategySignal } from './strategy-signal.entity';

/**
 * Historial de predicciones generadas por el sistema automático
 * Este historial es diferente al historial de apuestas del usuario
 * Muestra las señales que el sistema detectó y actuó
 */
@Entity('system_prediction_history')
export class SystemPredictionHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int', name: 'bookmaker_id' })
  @Index()
  bookmakerId: number;

  @ManyToOne(() => Bookmaker)
  @JoinColumn({ name: 'bookmaker_id' })
  bookmaker: Bookmaker;

  /**
   * ID de la sesión de apuestas
   */
  @Column({ type: 'uuid', name: 'session_id' })
  @Index()
  sessionId: string;

  /**
   * ID de la señal que disparó la predicción
   */
  @Column({ type: 'uuid', nullable: true, name: 'signal_id' })
  signalId: string | null;

  @ManyToOne(() => StrategySignal, { nullable: true })
  @JoinColumn({ name: 'signal_id' })
  signal: StrategySignal | null;

  /**
   * Nombre de la estrategia que generó la señal
   */
  @Column({ type: 'varchar', length: 100, name: 'strategy_name' })
  strategyName: string;

  /**
   * ID de la ronda
   */
  @Column({ type: 'varchar', length: 100, name: 'round_id' })
  @Index()
  roundId: string;

  /**
   * Multiplicador objetivo de la predicción
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'target_multiplier' })
  targetMultiplier: number;

  /**
   * Multiplicador donde entró la señal
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'entry_multiplier' })
  entryMultiplier: number | null;

  /**
   * Cantidad apostada
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'bet_amount' })
  betAmount: number;

  /**
   * Resultado de la predicción
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'result_multiplier' })
  resultMultiplier: number | null;

  /**
   * Estado de la predicción
   */
  @Column({ 
    type: 'enum', 
    enum: ['PENDING', 'WIN', 'LOSS', 'GALE'],
    default: 'PENDING'
  })
  @Index()
  status: 'PENDING' | 'WIN' | 'LOSS' | 'GALE';

  /**
   * Profit de la predicción
   */
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  profit: number | null;

  /**
   * Nivel de Gale (0 = sin gale, 1 = primer gale, etc)
   */
  @Column({ type: 'int', default: 0, name: 'gale_level' })
  galeLevel: number;

  /**
   * Timestamp de la predicción
   */
  @Column({ type: 'timestamp', name: 'predicted_at' })
  predictedAt: Date;

  /**
   * Timestamp del resultado
   */
  @Column({ type: 'timestamp', nullable: true, name: 'result_at' })
  resultAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
