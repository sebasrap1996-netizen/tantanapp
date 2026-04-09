import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { UserBettingSession } from './user-betting-session.entity';
import { StrategySignal } from './strategy-signal.entity';

/**
 * Historial de apuestas realizadas por el sistema automático
 */
@Entity('user_betting_history')
export class UserBettingHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'session_id' })
  @Index()
  sessionId: string;

  @ManyToOne(() => UserBettingSession)
  @JoinColumn({ name: 'session_id' })
  session: UserBettingSession;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * Datos de la señal que disparó la apuesta
   */
  @Column({ type: 'uuid', nullable: true, name: 'signal_id' })
  signalId: string | null;

  @ManyToOne(() => StrategySignal, { nullable: true })
  @JoinColumn({ name: 'signal_id' })
  signal: StrategySignal | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'signal_strategy' })
  signalStrategy: string | null;

  /**
   * Datos de la apuesta
   */
  @Column({ type: 'varchar', length: 100, name: 'round_id' })
  @Index()
  roundId: string;

  @Column({ type: 'int', name: 'bet_id' })
  betId: 1 | 2;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'bet_amount' })
  betAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'target_multiplier' })
  targetMultiplier: number;

  @Column({ type: 'varchar', length: 50, name: 'client_seed' })
  clientSeed: string;

  /**
   * Resultado
   */
  @Column({ 
    type: 'enum', 
    enum: ['PENDING', 'PLACED', 'CASHOUT', 'LOSS', 'GALE'],
    default: 'PENDING'
  })
  @Index()
  status: 'PENDING' | 'PLACED' | 'CASHOUT' | 'LOSS' | 'GALE';

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'result_multiplier' })
  resultMultiplier: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  profit: number | null;

  @Column({ type: 'int', default: 0, name: 'gale_level' })
  galeLevel: number;

  /**
   * Timestamps
   */
  @Column({ type: 'timestamp', name: 'bet_placed_at' })
  betPlacedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'result_at' })
  resultAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
